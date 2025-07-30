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

# EXPANDED Vocabulary concepts by complexity for grade assignment - MORE GRANULAR
SIMPLE_VOCABULARY = [
    # Household items (broken down)
    "kitchen_utensils", "bedroom_furniture", "bathroom_items", "living_room_objects",
    "garage_tools", "garden_equipment", "laundry_items", "cleaning_supplies",
    
    # School-related (broken down)
    "classroom_objects", "playground_equipment", "cafeteria_items", "library_materials",
    "art_supplies", "music_instruments_basic", "sports_equipment_basic", "science_lab_basic",
    
    # Nature and animals (broken down)
    "farm_animals", "pet_animals", "wild_animals", "ocean_creatures",
    "birds_common", "insects_common", "trees_plants", "flowers_common",
    "weather_phenomena", "seasons_vocabulary", "landscape_features", "sky_objects",
    
    # Food and eating (broken down)
    "fruits_common", "vegetables_common", "breakfast_foods", "lunch_items",
    "dinner_foods", "snacks_treats", "beverages_basic", "cooking_ingredients_basic",
    
    # People and relationships
    "family_members", "community_helpers", "occupations_basic", "emotions_basic",
    "body_parts_basic", "clothing_basic", "personality_traits_simple", "daily_activities",
    
    # Basic descriptors
    "colors_shades", "sizes_dimensions", "shapes_basic", "textures_basic",
    "temperatures", "sounds_basic", "tastes_basic", "smells_basic"
]

MEDIUM_VOCABULARY = [
    # Academic subjects (broken down)
    "mathematics_terms", "science_vocabulary", "history_terms", "geography_vocabulary",
    "literature_terms", "grammar_terminology", "computer_terms", "research_vocabulary",
    
    # Professional fields (broken down)
    "medical_terms_basic", "legal_terms_basic", "business_vocabulary", "technology_terms",
    "engineering_basic", "architecture_terms", "journalism_vocabulary", "education_terms",
    
    # Advanced descriptors (broken down)
    "character_traits_complex", "emotional_states", "physical_descriptions", "mental_states",
    "behavioral_patterns", "social_interactions", "cultural_terms", "ethical_concepts",
    
    # Action and process words (broken down)
    "scientific_processes", "mathematical_operations", "creative_processes", "analytical_thinking",
    "communication_methods", "problem_solving_terms", "decision_making_words", "planning_vocabulary",
    
    # Environment and society (broken down)
    "urban_vocabulary", "rural_terms", "environmental_issues", "climate_vocabulary",
    "government_terms", "economic_concepts", "social_movements", "cultural_celebrations",
    
    # Advanced activities (broken down)
    "artistic_techniques", "musical_terms_advanced", "athletic_movements", "culinary_techniques",
    "construction_methods", "manufacturing_processes", "transportation_systems", "communication_technology"
]

COMPLEX_VOCABULARY = [
    # Specialized academic (broken down)
    "philosophy_terms", "psychology_concepts", "sociology_vocabulary", "anthropology_terms",
    "linguistics_terminology", "rhetoric_devices", "logic_terms", "epistemology_vocabulary",
    
    # Advanced professional (broken down)
    "medical_specialties", "legal_procedures", "financial_instruments", "scientific_research",
    "technological_innovations", "diplomatic_language", "military_terminology", "aerospace_vocabulary",
    
    # Abstract concepts (broken down)
    "theoretical_frameworks", "metaphysical_concepts", "aesthetic_principles", "ethical_theories",
    "political_ideologies", "economic_theories", "psychological_phenomena", "sociological_patterns",
    
    # Literary and artistic (broken down)
    "literary_criticism", "poetic_devices", "narrative_techniques", "dramatic_elements",
    "artistic_movements", "musical_theory", "architectural_styles", "cinematic_vocabulary",
    
    # Scientific and technical (broken down)
    "quantum_physics_terms", "molecular_biology", "chemical_nomenclature", "geological_terminology",
    "astronomical_vocabulary", "mathematical_proofs", "computer_algorithms", "engineering_principles",
    
    # Cultural and historical (broken down)
    "ancient_civilizations", "historical_movements", "cultural_anthropology", "religious_studies",
    "mythological_references", "archaeological_terms", "ethnographic_vocabulary", "geopolitical_concepts"
]

class VocabularyDuplicateDetector:
    """Robust duplicate detection for vocabulary words"""
    
    def __init__(self):
        self.existing_words: Set[str] = set()
        self.existing_questions: Set[str] = set()
        self.words_by_grade: Dict[int, Set[str]] = {5: set(), 6: set(), 7: set(), 8: set(), 9: set()}
        
    def load_existing_vocabulary(self):
        """Load all existing vocabulary words for comparison"""
        try:
            print("🔍 Loading existing vocabulary for duplicate detection...")
            
            # Get all existing vocabulary questions
            result = supabase.table('question_cache')\
                .select('question, grade')\
                .eq('topic', 'english_vocabulary')\
                .not_.is_('question', 'null')\
                .execute()
            
            for record in result.data:
                if record['question'] and 'word' in record['question']:
                    word = record['question']['word'].lower()
                    self.existing_words.add(word)
                    
                    # Track by grade
                    grade = record.get('grade', 5)
                    if grade in self.words_by_grade:
                        self.words_by_grade[grade].add(word)
                        
                if record['question'] and 'question' in record['question']:
                    question_text = record['question']['question'].lower()
                    self.existing_questions.add(question_text)
            
            print(f"✅ Loaded {len(self.existing_words)} existing vocabulary words")
            for grade, words in self.words_by_grade.items():
                print(f"   Grade {grade}: {len(words)} words")
            
        except Exception as e:
            print(f"⚠️  Failed to load existing vocabulary: {e}")
            self.existing_words = set()
            self.existing_questions = set()
    
    def is_duplicate(self, word: str, question: str) -> Tuple[bool, str]:
        """Check if word or question is duplicate"""
        if word.lower() in self.existing_words:
            return True, f"Word '{word}' already exists"
        
        if question.lower() in self.existing_questions:
            return True, f"Question already exists"
            
        return False, "Unique vocabulary item"
    
    def add_word(self, word: str, question: str, grade: int):
        """Add new word to tracking"""
        self.existing_words.add(word.lower())
        self.existing_questions.add(question.lower())
        if grade in self.words_by_grade:
            self.words_by_grade[grade].add(word.lower())
    
    def get_existing_words_sample(self, limit: int = 50) -> List[str]:
        """Get a sample of existing words to exclude in prompt"""
        return list(self.existing_words)[:limit]

class ISEEVocabularyGenerator:
    def __init__(self):
        self.duplicate_detector = VocabularyDuplicateDetector()
        self.generation_stats = {
            'total_attempts': 0,
            'duplicates_rejected': 0,
            'successful_generations': 0,
            'failed_generations': 0,
            'total_generated_in_batch': 0,
            'total_kept_after_filter': 0
        }
        
    def initialize_system(self):
        """Initialize the vocabulary generation system"""
        print("🚀 Initializing ISEE Vocabulary Generator (Enhanced Version)...")
        
        # Load duplicate detection
        self.duplicate_detector.load_existing_vocabulary()
        return True
        
    def generate_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash for duplicate detection"""
        return hashlib.sha256(content.encode()).hexdigest()
    
    def get_difficulty_for_vocabulary_concept(self, vocabulary_concept: str) -> int:
        """Assign difficulty level based on vocabulary concept complexity"""
        if vocabulary_concept in SIMPLE_VOCABULARY:
            return 3
        elif vocabulary_concept in MEDIUM_VOCABULARY:
            return 5
        else:
            return 7
    
    def generate_vocabulary_batch(self, grade: int, complexity: str, concept: str, batch_size: int = 10) -> Optional[List[Dict]]:
        """Generate a larger batch of vocabulary questions to account for duplicates"""
        
        self.generation_stats['total_attempts'] += 1
        
        # Get sample of existing words to exclude
        exclude_words = self.duplicate_detector.get_existing_words_sample(100)
        exclude_words_str = ', '.join(exclude_words) if exclude_words else 'none'
        
        # Generate more than needed to account for duplicates
        generation_size = batch_size * 3  # Generate 3x to filter duplicates
        
        # Grade-specific guidance
        grade_guidance = {
            5: "Use simple, concrete words that 5th graders encounter in daily life",
            6: "Use slightly more advanced words appropriate for middle school entry",
            7: "Use academic vocabulary that 7th graders see in textbooks",
            8: "Use sophisticated words that challenge 8th grade readers",
            9: "Use advanced, complex words preparing for high school"
        }
        
        prompt = f"""You are an expert ISEE test prep content creator specializing in vocabulary education.

TASK: Generate exactly {generation_size} UNIQUE vocabulary questions for grade {grade} students.

VOCABULARY CONCEPT: {concept}
COMPLEXITY LEVEL: {complexity}
GRADE LEVEL: {grade}
GRADE GUIDANCE: {grade_guidance.get(grade, "")}

CRITICAL REQUIREMENTS:
1. Each vocabulary item must be COMPLETELY UNIQUE
2. DO NOT use any of these existing words: {exclude_words_str[:500]}...
3. Words must be specifically appropriate for {concept} category
4. Words should match grade {grade} reading level precisely
5. Focus on {concept} vocabulary type
6. Each question tests word meaning in context

IMPORTANT VARIETY RULES:
- For grade 5: Use simpler, more common variants of {concept}
- For grade 6-7: Use intermediate difficulty {concept} words
- For grade 8-9: Use advanced, sophisticated {concept} words
- Vary word types (nouns, verbs, adjectives) within the concept
- Include both common and less common words within the grade level

REQUIRED JSON STRUCTURE:
{{
    "vocabulary_items": [
        {{
            "word": "example",
            "part_of_speech": "noun",
            "grade_level_justification": "This word is appropriate for grade {grade} because...",
            "question": "The scientist's meticulous observation led to a breakthrough. What does 'meticulous' mean?",
            "options": {{
                "A": "careless and rushed",
                "B": "extremely careful and precise",
                "C": "moderately attentive",
                "D": "quick and efficient"
            }},
            "correct": "B",
            "explanation": "B is correct because 'meticulous' means showing great attention to detail and being very careful and precise. A is incorrect as it's the opposite. C is incorrect as it understates the meaning. D is incorrect as it emphasizes speed rather than carefulness.",
            "context_sentence": "The scientist's meticulous observation led to a breakthrough.",
            "difficulty_rating": "grade_{grade}_appropriate"
        }}
        // ... {generation_size - 1} more UNIQUE items
    ],
    "concept": "{concept}",
    "grade": {grade}
}}

CRUCIAL: Generate {generation_size} DIFFERENT words. Do not repeat any words. Each word must be unique and specifically suited for grade {grade} students studying {concept}."""

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
            if 'vocabulary_items' not in content:
                raise ValueError("Missing vocabulary_items in response")
            
            self.generation_stats['total_generated_in_batch'] += len(content['vocabulary_items'])
            
            # Validate each item and filter duplicates
            valid_items = []
            seen_in_batch = set()
            
            for item in content['vocabulary_items']:
                required_fields = ['word', 'question', 'options', 'correct', 'explanation']
                if all(field in item for field in required_fields):
                    word_lower = item['word'].lower()
                    
                    # Check if word already seen in this batch
                    if word_lower in seen_in_batch:
                        continue
                    seen_in_batch.add(word_lower)
                    
                    # Check for duplicates against database
                    is_duplicate, reason = self.duplicate_detector.is_duplicate(
                        item['word'], 
                        item['question']
                    )
                    
                    if not is_duplicate:
                        valid_items.append(item)
                        if len(valid_items) >= batch_size:
                            break  # We have enough valid items
                    else:
                        self.generation_stats['duplicates_rejected'] += 1
            
            self.generation_stats['total_kept_after_filter'] += len(valid_items)
            
            if valid_items:
                print(f"✅ Generated {len(content['vocabulary_items'])} items, kept {len(valid_items)} valid vocabulary items for {concept} (Grade {grade})")
                return valid_items[:batch_size]  # Return only requested amount
            else:
                return None
                
        except Exception as e:
            print(f"❌ Vocabulary generation failed: {e}")
            self.generation_stats['failed_generations'] += 1
            return None
    
    def save_vocabulary_to_supabase(self, vocabulary_items: List[Dict], grade: int, difficulty: int, concept: str) -> int:
        """Save generated vocabulary to Supabase"""
        
        saved_count = 0
        
        for item in vocabulary_items:
            try:
                # Generate unique hash
                content_for_hash = f"{item['word']}|{item['question']}|{item['correct']}"
                question_hash = self.generate_content_hash(content_for_hash)
                
                # Check if hash already exists
                existing = supabase.table('question_cache')\
                    .select('id')\
                    .eq('question_hash', question_hash)\
                    .execute()
                
                if existing.data:
                    continue
                
                # Build standardized question structure
                question_data = {
                    "word": item['word'],
                    "part_of_speech": item.get('part_of_speech', 'noun'),
                    "question": item['question'],
                    "options": item['options'],
                    "correct": item['correct'],
                    "explanation": item['explanation'],
                    "context_sentence": item.get('context_sentence', item['question']),
                    "vocabulary_concept": concept,
                    "grade_level_justification": item.get('grade_level_justification', '')
                }
                
                # Insert to Supabase
                insert_data = {
                    "topic": "english_vocabulary",
                    "difficulty": difficulty,
                    "grade": grade,
                    "question": question_data,
                    "ai_model": "gemini-2.5-flash",
                    "question_hash": question_hash
                }
                
                result = supabase.table('question_cache').insert(insert_data).execute()
                saved_count += 1
                
                # Add to duplicate detector
                self.duplicate_detector.add_word(item['word'], item['question'], grade)
                
            except Exception as e:
                print(f"❌ Failed to save vocabulary item: {e}")
                
        if saved_count > 0:
            self.generation_stats['successful_generations'] += saved_count
            print(f"✅ Saved {saved_count} vocabulary items for {concept} (Grade {grade})")
            
        return saved_count
    
    def generate_vocabulary_for_all_grades(self):
        """Generate 100 vocabulary words for each grade and complexity combination"""
        
        if not self.initialize_system():
            print("❌ Failed to initialize system")
            return
        
        # Define the combinations
        grades = [5, 6, 7, 8, 9]
        complexities = [
            ("simple", SIMPLE_VOCABULARY),
            ("medium", MEDIUM_VOCABULARY),
            ("complex", COMPLEX_VOCABULARY)
        ]
        
        total_generated = 0
        
        # Process each grade
        for grade in grades:
            print(f"\n📚 Processing Grade {grade}")
            
            # Process each complexity level
            for complexity_name, concept_list in complexities:
                print(f"\n  📊 Complexity: {complexity_name.upper()} ({len(concept_list)} concepts)")
                
                # Calculate target words per concept
                words_per_concept = 100 // len(concept_list)
                remaining_words = 100 % len(concept_list)
                
                grade_complexity_total = 0
                
                # Shuffle concepts to vary generation
                shuffled_concepts = concept_list.copy()
                random.shuffle(shuffled_concepts)
                
                # Process each concept
                for i, concept in enumerate(shuffled_concepts):
                    # Add extra words to first concepts to reach exactly 100
                    target_words = words_per_concept + (1 if i < remaining_words else 0)
                    
                    print(f"\n    📝 Concept: {concept} (Target: {target_words} words)")
                    
                    # Determine difficulty based on complexity
                    if complexity_name == "simple":
                        difficulty = 3
                    elif complexity_name == "medium":
                        difficulty = 5
                    else:
                        difficulty = 7
                    
                    # Generate in batches
                    concept_total = 0
                    consecutive_failures = 0
                    
                    while concept_total < target_words and consecutive_failures < 3:
                        batch_size = min(10, target_words - concept_total)
                        
                        # Generate with retry logic
                        success = False
                        for attempt in range(1, MAX_RETRIES_PER_TOPIC + 1):
                            vocabulary_items = self.generate_vocabulary_batch(
                                grade, complexity_name, concept, batch_size
                            )
                            
                            if vocabulary_items and len(vocabulary_items) > 0:
                                saved = self.save_vocabulary_to_supabase(
                                    vocabulary_items, grade, difficulty, concept
                                )
                                concept_total += saved
                                consecutive_failures = 0
                                success = True
                                break
                            
                            # Add delay between retries
                            if attempt < MAX_RETRIES_PER_TOPIC:
                                time.sleep(1)
                        
                        if not success:
                            consecutive_failures += 1
                            print(f"      ⚠️  Failed to generate after {MAX_RETRIES_PER_TOPIC} attempts")
                    
                    grade_complexity_total += concept_total
                    print(f"      Generated {concept_total} words for {concept}")
                
                print(f"\n  ✅ Total for Grade {grade} {complexity_name}: {grade_complexity_total} words")
                total_generated += grade_complexity_total
        
        # Print final statistics
        self._print_generation_stats(total_generated)
    
    def _print_generation_stats(self, total_generated: int):
        """Print comprehensive generation statistics"""
        stats = self.generation_stats
        
        print(f"\n🎉 Vocabulary generation complete!")
        print(f"📊 GENERATION STATISTICS:")
        print(f"   Total vocabulary words generated: {total_generated}")
        print(f"   Total generation attempts: {stats['total_attempts']}")
        print(f"   Total items generated by AI: {stats['total_generated_in_batch']}")
        print(f"   Total items kept after filtering: {stats['total_kept_after_filter']}")
        print(f"   Successful saves to database: {stats['successful_generations']}")
        print(f"   Duplicates rejected: {stats['duplicates_rejected']}")
        print(f"   Failed generations: {stats['failed_generations']}")
        
        if stats['total_generated_in_batch'] > 0:
            efficiency = (stats['total_kept_after_filter'] / stats['total_generated_in_batch']) * 100
            print(f"   Generation efficiency: {efficiency:.1f}%")
        
        if stats['total_attempts'] > 0:
            success_rate = (stats['successful_generations'] / (stats['successful_generations'] + stats['failed_generations'])) * 100 if (stats['successful_generations'] + stats['failed_generations']) > 0 else 0
            print(f"   Success rate: {success_rate:.1f}%")

def main():
    """Main execution function"""
    generator = ISEEVocabularyGenerator()
    
    print("🔧 ISEE Vocabulary Generator Starting (Enhanced Version)...")
    print(f"📚 Generating 100 words for each grade (5-9) and complexity level")
    print(f"🛡️  Enhanced duplicate detection with grade tracking")
    print(f"📊 Expanded categories: {len(SIMPLE_VOCABULARY) + len(MEDIUM_VOCABULARY) + len(COMPLEX_VOCABULARY)} total concepts")
    print(f"📊 Total target: 1,500 vocabulary words (5 grades × 3 complexities × 100 words)")
    
    # Generate vocabulary for all grade/complexity combinations
    generator.generate_vocabulary_for_all_grades()
    
    print("\n✅ All operations completed successfully!")

if __name__ == "__main__":
    main()