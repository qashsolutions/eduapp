import os
import json
import hashlib
import random
import re
import requests
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Set
import google.generativeai as genai
from supabase import create_client, Client
from dotenv import load_dotenv
from difflib import SequenceMatcher
import time

# Load environment variables
load_dotenv('.env.local')

# Get values directly
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

# Debug
print(f"URL loaded: {SUPABASE_URL is not None}")
print(f"KEY loaded: {SUPABASE_KEY is not None}")
print(f"GEMINI loaded: {GEMINI_API_KEY is not None}")

if not all([SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY]):
    print("❌ Missing environment variables!")
    exit(1)

# Initialize clients
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Constants for duplicate detection
FUZZY_SIMILARITY_THRESHOLD = 0.85  # 85% similarity triggers duplicate detection
MAX_RETRIES_PER_TOPIC = 5  # Maximum attempts before skipping topic

# Spelling bee concepts by complexity - MORE COMPLEX THAN OTHER TOPICS
SIMPLE_SPELLBEE = [
    "basic_phonics_patterns", "short_vowel_sounds", "long_vowel_sounds", "consonant_blends",
    "silent_letters_basic", "double_consonants", "common_prefixes", "common_suffixes",
    "pluralization_rules", "simple_homophones", "sight_words_advanced", "compound_words_basic",
    "syllable_patterns_basic", "vowel_teams", "r_controlled_vowels"
]

MEDIUM_SPELLBEE = [
    "greek_roots", "latin_roots", "advanced_prefixes", "advanced_suffixes",
    "irregular_plurals", "foreign_loanwords_common", "scientific_terminology_basic", "geographical_terms",
    "homographs_homophones", "consonant_alternations", "vowel_alternations", "stress_patterns",
    "british_american_variations", "technical_vocabulary", "academic_word_families"
]

COMPLEX_SPELLBEE = [
    "etymology_advanced", "morphological_analysis", "phonological_processes", "orthographic_depth",
    "schwa_unstressed_syllables", "assimilation_patterns", "dissimilation_patterns", "metathesis_examples",
    "epenthesis_syncope", "foreign_loanwords_advanced", "scientific_nomenclature", "medical_terminology",
    "legal_terminology", "philosophical_terms", "linguistic_terminology"
]

# Additional ultra-complex category for spelling bee
ULTRA_COMPLEX_SPELLBEE = [
    "championship_level_words", "scripps_bee_finalists", "national_bee_champions", "etymology_champions",
    "polyglot_borrowings", "technical_jargon_specialized", "archaic_literary_terms", "obsolete_spellings_historical",
    "phonetic_transcription_challenges", "morphophonemic_alternations", "suprasegmental_features", "prosodic_patterns",
    "orthographic_anomalies", "etymological_doublets", "calques_loan_translations"
]

class SpellBeeDuplicateDetector:
    """Robust duplicate detection for spelling bee questions"""
    
    def __init__(self):
        self.existing_words: Set[str] = set()
        self.existing_questions: Set[str] = set()
        
    def load_existing_spellbee(self):
        """Load all existing spelling bee questions for comparison"""
        try:
            print("🔍 Loading existing spelling bee words for duplicate detection...")
            
            # Get all existing spelling bee questions
            result = supabase.table('question_cache')\
                .select('question')\
                .eq('topic', 'english_spelling')\
                .not_.is_('question', 'null')\
                .execute()
            
            for record in result.data:
                if record['question'] and 'word' in record['question']:
                    word = record['question']['word'].lower()
                    self.existing_words.add(word)
                if record['question'] and 'question' in record['question']:
                    question_text = record['question']['question'].lower()
                    self.existing_questions.add(question_text)
            
            print(f"✅ Loaded {len(self.existing_words)} existing spelling bee words for comparison")
            
        except Exception as e:
            print(f"⚠️  Failed to load existing spelling bee words: {e}")
            self.existing_words = set()
            self.existing_questions = set()
    
    def is_duplicate(self, word: str, question: str) -> Tuple[bool, str]:
        """Check if word or question is duplicate"""
        if word.lower() in self.existing_words:
            return True, f"Word '{word}' already exists"
        
        if question.lower() in self.existing_questions:
            return True, f"Question already exists"
            
        return False, "Unique spelling bee item"
    
    def add_word(self, word: str, question: str):
        """Add new word to tracking"""
        self.existing_words.add(word.lower())
        self.existing_questions.add(question.lower())

class ISEESpellBeeGenerator:
    def __init__(self):
        self.duplicate_detector = SpellBeeDuplicateDetector()
        self.generation_stats = {
            'total_attempts': 0,
            'duplicates_rejected': 0,
            'successful_generations': 0,
            'failed_generations': 0
        }
        
    def initialize_system(self):
        """Initialize the spelling bee generation system"""
        print("🚀 Initializing ISEE Spelling Bee Generator...")
        
        # Load duplicate detection
        self.duplicate_detector.load_existing_spellbee()
        return True
        
    def generate_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash for duplicate detection"""
        return hashlib.sha256(content.encode()).hexdigest()
    
    def get_difficulty_for_spellbee_concept(self, spellbee_concept: str) -> int:
        """Assign difficulty level based on spelling bee concept complexity"""
        if spellbee_concept in SIMPLE_SPELLBEE:
            return 2  # Slightly easier for basic spelling
        elif spellbee_concept in MEDIUM_SPELLBEE:
            return 4
        elif spellbee_concept in COMPLEX_SPELLBEE:
            return 6
        else:  # ULTRA_COMPLEX_SPELLBEE
            return 8
    
    def generate_spellbee_batch(self, grade: int, complexity: str, concept: str, batch_size: int = 10) -> Optional[List[Dict]]:
        """Generate a batch of spelling bee questions"""
        
        self.generation_stats['total_attempts'] += 1
        
        prompt = f"""You are an expert spelling bee coach and ISEE test prep content creator.

TASK: Generate exactly {batch_size} spelling bee questions for grade {grade} students.

SPELLING CONCEPT: {concept}
COMPLEXITY LEVEL: {complexity}
GRADE LEVEL: {grade}

CRITICAL REQUIREMENTS:
1. Each word must be unique and challenging
2. Words should test the specific concept: {concept}
3. Include pronunciation guide (phonetic)
4. Provide word origin/etymology
5. Create a sentence using the word

REQUIRED JSON STRUCTURE:
{{
    "spellbee_items": [
        {{
            "word": "meticulous",
            "pronunciation": "meh-TIK-yuh-lus",
            "part_of_speech": "adjective",
            "definition": "showing great attention to detail; very careful and precise",
            "etymology": "From Latin 'meticulosus' meaning fearful, from 'metus' (fear)",
            "question": "Spell the word that means 'extremely careful and precise'",
            "sentence": "The scientist was meticulous in recording every observation.",
            "difficulty_features": ["silent letter", "Latin origin", "unstressed syllable"],
            "common_misspellings": ["meticulious", "meticulus", "meticalous"],
            "spelling_tip": "Remember: it's -culous, not -culous"
        }}
        // ... {batch_size - 1} more items
    ],
    "concept": "{concept}",
    "grade": {grade}
}}

IMPORTANT:
- Generate exactly {batch_size} spelling bee items
- Each word must be different and appropriate for the concept
- Include challenging words that test specific spelling patterns
- Provide helpful etymology and memory tips
- List common misspellings students might make
- For {complexity} level, choose appropriately challenging words"""

        try:
            # Generate content
            response = model.generate_content(prompt)
            
            # Parse response
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
                
            content = json.loads(response_text)
            
            # Validate structure
            if 'spellbee_items' not in content:
                raise ValueError("Missing spellbee_items in response")
                
            if len(content['spellbee_items']) != batch_size:
                raise ValueError(f"Expected {batch_size} items, got {len(content['spellbee_items'])}")
            
            # Validate each item
            valid_items = []
            for item in content['spellbee_items']:
                required_fields = ['word', 'pronunciation', 'definition', 'question', 'sentence']
                if all(field in item for field in required_fields):
                    # Check for duplicates
                    is_duplicate, reason = self.duplicate_detector.is_duplicate(
                        item['word'], 
                        item['question']
                    )
                    
                    if not is_duplicate:
                        valid_items.append(item)
                    else:
                        print(f"⚠️  Skipping duplicate: {reason}")
                        self.generation_stats['duplicates_rejected'] += 1
            
            if valid_items:
                print(f"✅ Generated {len(valid_items)} valid spelling bee items for {concept} (Grade {grade})")
                return valid_items
            else:
                return None
                
        except Exception as e:
            print(f"❌ Spelling bee generation failed: {e}")
            self.generation_stats['failed_generations'] += 1
            return None
    
    def save_spellbee_to_supabase(self, spellbee_items: List[Dict], grade: int, difficulty: int, concept: str) -> int:
        """Save generated spelling bee questions to Supabase"""
        
        saved_count = 0
        
        for item in spellbee_items:
            try:
                # Generate unique hash
                content_for_hash = f"{item['word']}|{item['question']}|spelling"
                question_hash = self.generate_content_hash(content_for_hash)
                
                # Check if hash already exists
                existing = supabase.table('question_cache')\
                    .select('id')\
                    .eq('question_hash', question_hash)\
                    .execute()
                
                if existing.data:
                    continue
                
                # Build standardized question structure for spelling bee
                question_data = {
                    "word": item['word'],
                    "pronunciation": item['pronunciation'],
                    "part_of_speech": item.get('part_of_speech', 'word'),
                    "definition": item['definition'],
                    "etymology": item.get('etymology', ''),
                    "question": item['question'],
                    "sentence": item['sentence'],
                    "difficulty_features": item.get('difficulty_features', []),
                    "common_misspellings": item.get('common_misspellings', []),
                    "spelling_tip": item.get('spelling_tip', ''),
                    "spelling_concept": concept,
                    "correct": item['word']  # For consistency with other question types
                }
                
                # Insert to Supabase
                insert_data = {
                    "topic": "english_spelling",
                    "difficulty": difficulty,
                    "grade": grade,
                    "question": question_data,
                    "ai_model": "gemini-2.5-flash",
                    "question_hash": question_hash
                }
                
                result = supabase.table('question_cache').insert(insert_data).execute()
                saved_count += 1
                
                # Add to duplicate detector
                self.duplicate_detector.add_word(item['word'], item['question'])
                
            except Exception as e:
                print(f"❌ Failed to save spelling bee item: {e}")
                
        if saved_count > 0:
            self.generation_stats['successful_generations'] += saved_count
            print(f"✅ Saved {saved_count} spelling bee items for {concept} (Grade {grade})")
            
        return saved_count
    
    def generate_spellbee_for_all_grades(self):
        """Generate 100 spelling bee questions for each grade and complexity combination"""
        
        if not self.initialize_system():
            print("❌ Failed to initialize system")
            return
        
        # Define the combinations - including ultra complex for spelling bee
        grades = [5, 6, 7, 8, 9]
        complexities = [
            ("simple", SIMPLE_SPELLBEE),
            ("medium", MEDIUM_SPELLBEE),
            ("complex", COMPLEX_SPELLBEE),
            ("ultra_complex", ULTRA_COMPLEX_SPELLBEE)  # Extra level for spelling bee
        ]
        
        total_generated = 0
        
        # Process each grade
        for grade in grades:
            print(f"\n📚 Processing Grade {grade}")
            
            # Skip ultra_complex for lower grades
            grade_complexities = complexities if grade >= 7 else complexities[:3]
            
            # Process each complexity level
            for complexity_name, concept_list in grade_complexities:
                print(f"\n  📊 Complexity: {complexity_name.upper()}")
                
                # Calculate target words per concept
                words_per_concept = 100 // len(concept_list)
                remaining_words = 100 % len(concept_list)
                
                grade_complexity_total = 0
                
                # Process each concept
                for i, concept in enumerate(concept_list):
                    # Add extra words to first concepts to reach exactly 100
                    target_words = words_per_concept + (1 if i < remaining_words else 0)
                    
                    print(f"\n    📝 Concept: {concept} (Target: {target_words} words)")
                    
                    # Determine difficulty based on complexity
                    if complexity_name == "simple":
                        difficulty = 2
                    elif complexity_name == "medium":
                        difficulty = 4
                    elif complexity_name == "complex":
                        difficulty = 6
                    else:  # ultra_complex
                        difficulty = 8
                    
                    # Generate in batches of 10
                    concept_total = 0
                    while concept_total < target_words:
                        batch_size = min(10, target_words - concept_total)
                        
                        # Generate with retry logic
                        for attempt in range(1, MAX_RETRIES_PER_TOPIC + 1):
                            spellbee_items = self.generate_spellbee_batch(
                                grade, complexity_name, concept, batch_size
                            )
                            
                            if spellbee_items:
                                saved = self.save_spellbee_to_supabase(
                                    spellbee_items, grade, difficulty, concept
                                )
                                concept_total += saved
                                break
                            
                            # Add delay between retries
                            if attempt < MAX_RETRIES_PER_TOPIC:
                                time.sleep(1)
                    
                    grade_complexity_total += concept_total
                    print(f"      Generated {concept_total} spelling bee words for {concept}")
                
                print(f"\n  ✅ Total for Grade {grade} {complexity_name}: {grade_complexity_total} spelling bee words")
                total_generated += grade_complexity_total
        
        # Print final statistics
        self._print_generation_stats(total_generated)
    
    def _print_generation_stats(self, total_generated: int):
        """Print comprehensive generation statistics"""
        stats = self.generation_stats
        
        print(f"\n🎉 Spelling bee generation complete!")
        print(f"📊 GENERATION STATISTICS:")
        print(f"   Total spelling bee words generated: {total_generated}")
        print(f"   Total generation attempts: {stats['total_attempts']}")
        print(f"   Successful generations: {stats['successful_generations']}")
        print(f"   Duplicates rejected: {stats['duplicates_rejected']}")
        print(f"   Failed generations: {stats['failed_generations']}")
        
        if stats['total_attempts'] > 0:
            success_rate = (stats['successful_generations'] / (stats['successful_generations'] + stats['failed_generations'])) * 100 if (stats['successful_generations'] + stats['failed_generations']) > 0 else 0
            print(f"   Success rate: {success_rate:.1f}%")

def main():
    """Main execution function"""
    generator = ISEESpellBeeGenerator()
    
    print("🔧 ISEE Spelling Bee Generator Starting...")
    print(f"📚 Generating 100 spelling bee words for each grade (5-9) and complexity level")
    print(f"🛡️  Duplicate detection enabled")
    print(f"📊 Note: Grades 5-6 skip ultra_complex level")
    print(f"📊 Total target: ~1,700 spelling bee words")
    
    # Generate spelling bee words for all grade/complexity combinations
    generator.generate_spellbee_for_all_grades()
    
    print("\n✅ All operations completed successfully!")

if __name__ == "__main__":
    main()