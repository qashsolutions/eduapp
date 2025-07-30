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

# ============================================================================
# ENVIRONMENT SETUP AND CONFIGURATION
# ============================================================================
load_dotenv('.env.local')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

print(f"URL loaded: {SUPABASE_URL is not None}")
print(f"KEY loaded: {SUPABASE_KEY is not None}")
print(f"GEMINI loaded: {GEMINI_API_KEY is not None}")

if not all([SUPABASE_URL, SUPABASE_KEY, GEMINI_API_KEY]):
    print("❌ Missing environment variables!")
    exit(1)

# ============================================================================
# API CLIENT INITIALIZATION
# ============================================================================
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ============================================================================
# SYSTEM CONSTANTS
# ============================================================================
FUZZY_SIMILARITY_THRESHOLD = 0.85
MAX_BATCH_ATTEMPTS = 2
MAX_CONCEPT_FAILURES = 2
PROFANITY_CHECK_ENABLED = True
CONTENT_SAFETY_LEVEL = "STRICT"

# ============================================================================
# GRADE 7 QUESTION TYPE CONCEPTS
# ============================================================================

# Grammar concepts by complexity
SIMPLE_GRAMMAR_CONCEPTS = [
    "simple_sentence_identification", "compound_sentence_formation", "complex_sentence_recognition",
    "sentence_fragment_correction", "run_on_sentence_repair", "noun_proper_common_distinction",
    "pronoun_antecedent_agreement", "verb_action_linking_distinction", "present_tense_consistency",
    "past_tense_regular_formation", "future_tense_will_usage", "helping_verb_identification"
]

MEDIUM_GRAMMAR_CONCEPTS = [
    "independent_clause_identification", "dependent_clause_recognition", "subordinating_conjunction_usage",
    "comma_coordinating_conjunction_rule", "semicolon_independent_clause_joining", "past_participle_formation_usage",
    "present_participle_progressive_tense", "irregular_verb_past_forms", "pronoun_case_subject_object",
    "comparative_adjective_formation", "superlative_adjective_formation", "dangling_modifier_identification"
]

COMPLEX_GRAMMAR_CONCEPTS = [
    "compound_complex_sentence_formation", "parallel_structure_series_consistency", "subjunctive_mood_hypothetical_situations",
    "verb_tense_sequence_consistency", "gerund_infinitive_verb_complements", "em_dash_parenthetical_emphasis",
    "connotation_denotation_word_choice", "formal_informal_register_appropriateness", "collective_noun_verb_agreement",
    "pronoun_reference_ambiguity_elimination"
]

# Synonym concepts by complexity
SIMPLE_SYNONYM_CONCEPTS = [
    "basic_emotions_happy_sad", "physical_descriptions_big_small", "action_words_run_walk",
    "time_concepts_early_late", "weather_descriptions_hot_cold", "animal_characteristics",
    "food_descriptions_sweet_sour", "color_variations_bright_dark"
]

MEDIUM_SYNONYM_CONCEPTS = [
    "academic_skills_study_learn", "communication_words_speak_talk", "thinking_verbs_analyze_examine",
    "character_traits_brave_courageous", "difficulty_levels_hard_challenging", "size_comparisons_huge_enormous",
    "speed_descriptions_fast_quick", "emotion_intensity_angry_furious"
]

COMPLEX_SYNONYM_CONCEPTS = [
    "academic_precision_meticulous_thorough", "analytical_thinking_systematic_methodical", "persuasive_language_compelling_convincing",
    "creative_expression_innovative_imaginative", "leadership_qualities_authoritative_commanding", "scientific_accuracy_precise_exact",
    "literary_analysis_comprehensive_exhaustive", "critical_evaluation_discerning_perceptive"
]

# Antonym concepts by complexity  
SIMPLE_ANTONYM_CONCEPTS = [
    "spatial_opposites_high_low", "time_opposites_early_late", "size_opposites_big_small",
    "temperature_opposites_hot_cold", "emotion_opposites_happy_sad", "speed_opposites_fast_slow",
    "texture_opposites_rough_smooth", "brightness_opposites_light_dark"
]

MEDIUM_ANTONYM_CONCEPTS = [
    "personality_opposites_kind_mean", "academic_opposites_success_failure", "social_opposites_popular_unpopular",
    "behavior_opposites_polite_rude", "energy_opposites_active_passive", "attitude_opposites_positive_negative",
    "confidence_opposites_bold_timid", "work_ethic_opposites_diligent_lazy"
]

COMPLEX_ANTONYM_CONCEPTS = [
    "intellectual_opposites_sophisticated_primitive", "analytical_opposites_systematic_chaotic", "communication_opposites_articulate_inarticulate",
    "academic_opposites_comprehensive_superficial", "leadership_opposites_authoritative_submissive", "creative_opposites_innovative_conventional",
    "evaluation_opposites_objective_subjective", "precision_opposites_accurate_approximate"
]

# Vocabulary concepts by complexity
SIMPLE_VOCABULARY_CONCEPTS = [
    "context_clues_definition", "context_clues_example", "context_clues_comparison",
    "prefix_meanings_basic", "suffix_meanings_basic", "root_word_identification",
    "compound_word_analysis", "multiple_meaning_words"
]

MEDIUM_VOCABULARY_CONCEPTS = [
    "context_clues_inference", "word_family_relationships", "greek_latin_roots",
    "advanced_prefixes_suffixes", "connotation_understanding", "figurative_language_meaning",
    "academic_vocabulary_usage", "technical_term_analysis"
]

COMPLEX_VOCABULARY_CONCEPTS = [
    "etymology_analysis", "semantic_relationships", "register_appropriateness",
    "nuanced_meaning_distinctions", "specialized_terminology", "metaphorical_usage",
    "academic_discourse_vocabulary", "precise_word_choice"
]

# Reading comprehension concepts by complexity
SIMPLE_COMPREHENSION_CONCEPTS = [
    "main_idea_identification", "detail_location", "sequence_understanding",
    "character_identification", "setting_recognition", "basic_inference",
    "cause_effect_simple", "fact_opinion_distinction"
]

MEDIUM_COMPREHENSION_CONCEPTS = [
    "theme_analysis", "character_motivation", "plot_development",
    "author_purpose", "tone_identification", "comparison_contrast",
    "prediction_making", "evidence_support"
]

COMPLEX_COMPREHENSION_CONCEPTS = [
    "implicit_meaning_analysis", "author_bias_detection", "literary_device_recognition",
    "argument_evaluation", "perspective_analysis", "synthesis_multiple_sources",
    "critical_analysis", "textual_evidence_evaluation"
]

# ============================================================================
# URL CONTENT EXTRACTION SYSTEM
# ============================================================================
class URLContentExtractor:
    """Extract and process content from URLs for question generation"""
    
    def __init__(self):
        self.extraction_stats = {
            'urls_loaded': 0, 'urls_processed': 0, 'content_extracted': 0, 'content_failed': 0
        }
    
    def load_urls_from_file(self, filename: str = 'urls.txt') -> List[str]:
        """Load URLs from text file"""
        urls = []
        try:
            if os.path.exists(filename):
                with open(filename, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        line = line.strip()
                        if line and line.startswith('http'):
                            urls.append(line)
                        elif line and not line.startswith('#'):
                            print(f"   ⚠️  Line {line_num}: Invalid URL format: {line[:50]}...")
                
                self.extraction_stats['urls_loaded'] = len(urls)
                print(f"✅ Loaded {len(urls)} URLs from {filename}")
                return urls
            else:
                print(f"⚠️  {filename} not found - will use AI-generated content only")
                return []
        except Exception as e:
            print(f"❌ Error loading URLs from {filename}: {e}")
            return []
    
    def fetch_url_content(self, url: str) -> Optional[str]:
        """Fetch content from URL with error handling"""
        try:
            print(f"   📥 Fetching content from: {url[:60]}...")
            response = requests.get(url, timeout=30, headers={
                'User-Agent': 'Mozilla/5.0 (Educational Content Extractor)'
            })
            response.raise_for_status()
            
            content = response.text
            if len(content) < 500:
                print(f"   ⚠️  Content too short ({len(content)} chars)")
                return None
                
            print(f"   ✅ Fetched {len(content)} characters of content")
            return content
        except Exception as e:
            print(f"   ❌ Failed to fetch URL content: {e}")
            return None
    
    def extract_grade7_passages(self, content: str, url: str, num_passages: int = 5) -> List[Dict]:
        """Extract Grade 7 appropriate passages for all question types"""
        
        prompt = f"""You are an expert Grade 7 educator extracting text passages for comprehensive language arts instruction.

TASK: Extract exactly {num_passages} text passages perfect for creating ALL types of Grade 7 questions:
- Grammar analysis questions
- Synonym/antonym questions  
- Vocabulary questions
- Reading comprehension questions

SOURCE URL: {url}

REQUIREMENTS FOR EACH PASSAGE:
1. 100-200 words long (ideal for multiple question types)
2. Age-appropriate for 12-13 year olds
3. Rich vocabulary with synonym/antonym opportunities
4. Interesting grammar structures for analysis
5. Complex enough for comprehension questions
6. Educational value and engaging topics
7. Complete sentences with clear meaning
8. No inappropriate content whatsoever

OUTPUT FORMAT (JSON):
{{
    "passages": [
        {{
            "text": "The complete passage text here...",
            "topic": "Brief topic description",
            "vocabulary_richness": "Rich vocabulary words present",
            "grammar_features": "Notable grammar structures",
            "comprehension_potential": "What comprehension skills this could test",
            "difficulty_level": "simple/medium/complex"
        }}
    ]
}}

CONTENT TO EXTRACT FROM:
{content[:8000]}...

Extract {num_passages} exemplary passages for comprehensive Grade 7 language arts instruction."""

        try:
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
            
            data = json.loads(response_text)
            
            if 'passages' in data and isinstance(data['passages'], list):
                print(f"   ✅ Extracted {len(data['passages'])} comprehensive passages")
                return data['passages']
            else:
                print(f"   ❌ Invalid passage extraction format")
                return []
        except Exception as e:
            print(f"   ❌ Passage extraction failed: {e}")
            return []

# ============================================================================
# UNIVERSAL DUPLICATE DETECTION SYSTEM
# ============================================================================
class UniversalDuplicateDetector:
    """Comprehensive duplicate detection for all question types"""
    
    def __init__(self):
        # Track all question types
        self.existing_questions: Set[str] = set()
        self.existing_passages: Set[str] = set()
        self.existing_concepts: Set[str] = set()
        self.question_fingerprints: List[str] = []
        
        self.loaded = False
        self.detection_stats = {
            'total_checks': 0, 'exact_duplicates': 0, 'fuzzy_duplicates': 0, 
            'unique_items': 0, 'load_time': 0.0
        }
    
    def load_existing_questions(self):
        """Load all existing questions from all topics"""
        if self.loaded:
            return
        
        try:
            start_time = time.time()
            print("🔍 Loading existing questions for duplicate detection...")
            
            # Get all existing English questions
            result = supabase.table('question_cache')\
                .select('question')\
                .like('topic', 'english_%')\
                .not_.is_('question', 'null')\
                .execute()
            
            for record in result.data:
                if record['question']:
                    question_data = record['question']
                    
                    # Extract question text
                    if 'question' in question_data:
                        question_text = question_data['question'].lower().strip()
                        self.existing_questions.add(question_text)
                        
                        fingerprint = re.sub(r'[^\w\s]', '', question_text)
                        fingerprint = ' '.join(fingerprint.split())
                        self.question_fingerprints.append(fingerprint)
                    
                    # Extract passages/contexts
                    for field in ['context', 'passage', 'context_sentence']:
                        if field in question_data:
                            text = question_data[field].lower().strip()
                            self.existing_passages.add(text)
                    
                    # Extract concepts
                    for field in ['grammar_concept', 'synonym_concept', 'antonym_concept']:
                        if field in question_data:
                            concept = question_data[field].lower().strip()
                            self.existing_concepts.add(concept)
            
            self.detection_stats['load_time'] = time.time() - start_time
            self.loaded = True
            
            print(f"✅ Loaded duplicate detection data:")
            print(f"   📝 {len(self.existing_questions)} questions")
            print(f"   📄 {len(self.existing_passages)} passages")
            print(f"   🎯 {len(self.existing_concepts)} concepts")
            
        except Exception as e:
            print(f"⚠️  Failed to load existing questions: {e}")
            self.loaded = True
    
    def is_duplicate(self, question_text: str, passage: str, concept: str) -> Tuple[bool, str]:
        """Comprehensive duplicate detection"""
        self.detection_stats['total_checks'] += 1
        
        question_lower = question_text.lower().strip()
        passage_lower = passage.lower().strip()
        concept_lower = concept.lower().strip()
        
        # Check exact matches
        if question_lower in self.existing_questions:
            self.detection_stats['exact_duplicates'] += 1
            return True, f"Exact question exists"
        
        if passage_lower in self.existing_passages:
            self.detection_stats['exact_duplicates'] += 1
            return True, f"Passage already used"
        
        # Check fuzzy similarity
        current_fingerprint = re.sub(r'[^\w\s]', '', question_lower)
        current_fingerprint = ' '.join(current_fingerprint.split())
        
        for existing_fingerprint in self.question_fingerprints:
            similarity = SequenceMatcher(None, current_fingerprint, existing_fingerprint).ratio()
            if similarity > FUZZY_SIMILARITY_THRESHOLD:
                self.detection_stats['fuzzy_duplicates'] += 1
                return True, f"Too similar to existing question ({similarity*100:.0f}% match)"
        
        self.detection_stats['unique_items'] += 1
        return False, "Unique question"
    
    def add_question(self, question_text: str, passage: str, concept: str):
        """Add new question to tracking"""
        question_lower = question_text.lower().strip()
        passage_lower = passage.lower().strip()
        concept_lower = concept.lower().strip()
        
        self.existing_questions.add(question_lower)
        self.existing_passages.add(passage_lower)
        self.existing_concepts.add(concept_lower)
        
        fingerprint = re.sub(r'[^\w\s]', '', question_lower)
        fingerprint = ' '.join(fingerprint.split())
        self.question_fingerprints.append(fingerprint)

# ============================================================================
# CONTENT SAFETY FILTER
# ============================================================================
class ContentSafetyFilter:
    """Zero tolerance content safety for educational materials"""
    
    def __init__(self):
        self.forbidden_terms = {"inappropriate", "offensive", "profane"}
        self.filter_stats = {'total_checks': 0, 'content_blocked': 0, 'content_approved': 0}
    
    def is_content_safe(self, text: str) -> Tuple[bool, str]:
        """Comprehensive content safety check"""
        self.filter_stats['total_checks'] += 1
        text_lower = text.lower()
        
        for forbidden_term in self.forbidden_terms:
            if forbidden_term in text_lower:
                self.filter_stats['content_blocked'] += 1
                return False, f"Contains inappropriate language: {forbidden_term}"
        
        if len(text) > 500:
            return False, "Content too long for Grade 7 students"
        
        self.filter_stats['content_approved'] += 1
        return True, "Content is safe and appropriate"

# ============================================================================
# UNIFIED GRADE 7 QUESTION GENERATOR
# ============================================================================
class Grade7UnifiedGenerator:
    """Unified generator for all Grade 7 question types from URL passages"""
    
    def __init__(self):
        self.duplicate_detector = UniversalDuplicateDetector()
        self.content_filter = ContentSafetyFilter()
        self.url_extractor = URLContentExtractor()
        
        self.passage_pool = []
        self.current_passage_index = 0
        
        self.generation_stats = {
            'total_attempts': 0, 'successful_generations': 0, 'failed_generations': 0,
            'duplicates_rejected': 0, 'content_safety_blocks': 0, 'database_saves': 0,
            'grammar_generated': 0, 'synonym_generated': 0, 'antonym_generated': 0,
            'vocabulary_generated': 0, 'comprehension_generated': 0
        }
        
        self.grade_level = 7
    
    def initialize_system(self) -> bool:
        """Initialize all system components"""
        print("🚀 Initializing Grade 7 Unified Question Generator...")
        
        try:
            print("🔍 Loading duplicate detection system...")
            self.duplicate_detector.load_existing_questions()
            
            print("🛡️  Initializing content safety filters...")
            is_safe, _ = self.content_filter.is_content_safe("Test sentence for grammar.")
            if not is_safe:
                raise Exception("Content safety filter not working")
            
            print("📥 Loading real-world content from URLs...")
            self.load_passage_pool()
            
            print("✅ System initialization completed successfully")
            return True
        except Exception as e:
            print(f"❌ System initialization failed: {e}")
            return False
    
    def load_passage_pool(self):
        """Load content from URLs to create passage pool"""
        print("📥 Loading URL content for all question types...")
        
        urls = self.url_extractor.load_urls_from_file('urls.txt')
        if not urls:
            print("⚠️  No URLs loaded - will use AI-generated content only")
            return
        
        for url_index, url in enumerate(urls, 1):
            print(f"\n📌 Processing URL {url_index}/{len(urls)}")
            
            content = self.url_extractor.fetch_url_content(url)
            if not content:
                continue
            
            passages = self.url_extractor.extract_grade7_passages(content, url, 5)
            if passages:
                self.passage_pool.extend(passages)
                print(f"   ✅ Added {len(passages)} passages to pool")
        
        print(f"\n📊 Total passages available: {len(self.passage_pool)}")
    
    def get_next_passage(self) -> Optional[Dict]:
        """Get next passage from pool"""
        if not self.passage_pool:
            return None
        
        if self.current_passage_index >= len(self.passage_pool):
            self.current_passage_index = 0
        
        passage = self.passage_pool[self.current_passage_index]
        self.current_passage_index += 1
        return passage
    
    def generate_content_hash(self, content: str) -> str:
        """Generate unique hash for database duplicate detection"""
        return hashlib.sha256(content.encode('utf-8')).hexdigest()
    
    def get_difficulty_rating(self, complexity: str) -> int:
        """Map complexity to numeric difficulty"""
        return {'simple': 3, 'medium': 5, 'complex': 7}.get(complexity, 5)
    
    def generate_questions_batch(self, question_type: str, complexity: str, concept: str, batch_size: int = 5) -> Optional[List[Dict]]:
        """Generate batch of questions for specific type and concept"""
        
        self.generation_stats['total_attempts'] += 1
        
        # Get passage content
        passage_data = self.get_next_passage()
        if not passage_data:
            passage_text = f"Generate appropriate Grade 7 content for {concept}"
        else:
            passage_text = passage_data['text']
        
        # Build type-specific prompt
        prompts = {
            'grammar': self._build_grammar_prompt,
            'synonym': self._build_synonym_prompt,
            'antonym': self._build_antonym_prompt,
            'vocabulary': self._build_vocabulary_prompt,
            'comprehension': self._build_comprehension_prompt
        }
        
        if question_type not in prompts:
            return None
        
        prompt = prompts[question_type](complexity, concept, passage_text, batch_size)
        
        try:
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
            
            content = json.loads(response_text)
            
            # Validate structure
            items_key = f'{question_type}_items'
            if items_key not in content:
                raise ValueError(f"Missing {items_key} in response")
            
            # Validate and filter items
            valid_items = []
            for item in content[items_key]:
                # Check required fields
                required_fields = ['question', 'options', 'correct', 'explanation']
                if not all(field in item for field in required_fields):
                    continue
                
                # Content safety check
                all_text = f"{item['question']} {item['explanation']}"
                all_text += " ".join(item['options'].values())
                is_safe, _ = self.content_filter.is_content_safe(all_text)
                if not is_safe:
                    self.generation_stats['content_safety_blocks'] += 1
                    continue
                
                # Duplicate check
                is_duplicate, _ = self.duplicate_detector.is_duplicate(
                    item['question'], passage_text, concept
                )
                if is_duplicate:
                    self.generation_stats['duplicates_rejected'] += 1
                    continue
                
                valid_items.append(item)
                self.duplicate_detector.add_question(item['question'], passage_text, concept)
            
            if valid_items:
                self.generation_stats['successful_generations'] += len(valid_items)
                self.generation_stats[f'{question_type}_generated'] += len(valid_items)
                return valid_items
            else:
                self.generation_stats['failed_generations'] += 1
                return None
                
        except Exception as e:
            print(f"   ❌ {question_type} generation failed: {e}")
            self.generation_stats['failed_generations'] += 1
            return None
    
    def _build_grammar_prompt(self, complexity: str, concept: str, passage: str, batch_size: int) -> str:
        """Build grammar question prompt"""
        return f"""Generate exactly {batch_size} Grade 7 grammar questions.

CONCEPT: {concept}
COMPLEXITY: {complexity}
PASSAGE: {passage}

Create questions that analyze grammar within this text context.

JSON FORMAT:
{{
    "grammar_items": [
        {{
            "context_sentence": "Sentence from passage",
            "question": "Grammar question about the sentence",
            "options": {{"A": "option1", "B": "option2", "C": "option3", "D": "option4", "E": "option5"}},
            "correct": "B",
            "explanation": "Why B is correct and others wrong, plus grammar concept explanation",
            "grammar_concept": "{concept}"
        }}
    ]
}}"""
    
    def _build_synonym_prompt(self, complexity: str, concept: str, passage: str, batch_size: int) -> str:
        """Build synonym question prompt"""
        return f"""Generate exactly {batch_size} Grade 7 synonym questions using words from this passage.

CONCEPT: {concept}
COMPLEXITY: {complexity}
PASSAGE: {passage}

Create synonym questions using vocabulary from the passage.

JSON FORMAT:
{{
    "synonym_items": [
        {{
            "base_word": "word from passage",
            "question": "Which word means the same as 'base_word'?",
            "options": {{"A": "option1", "B": "option2", "C": "option3", "D": "option4", "E": "option5"}},
            "correct": "C",
            "explanation": "Why C is correct synonym and others are wrong",
            "context_example": "Original sentence from passage"
        }}
    ]
}}"""
    
    def _build_antonym_prompt(self, complexity: str, concept: str, passage: str, batch_size: int) -> str:
        """Build antonym question prompt"""
        return f"""Generate exactly {batch_size} Grade 7 antonym questions using words from this passage.

CONCEPT: {concept}
COMPLEXITY: {complexity}  
PASSAGE: {passage}

Create antonym questions using vocabulary from the passage.

JSON FORMAT:
{{
    "antonym_items": [
        {{
            "base_word": "word from passage",
            "question": "Which word means the OPPOSITE of 'base_word'?",
            "options": {{"A": "option1", "B": "option2", "C": "option3", "D": "option4", "E": "option5"}},
            "correct": "D",
            "explanation": "Why D is correct antonym and others are wrong",
            "context_example": "Original sentence from passage"
        }}
    ]
}}"""
    
    def _build_vocabulary_prompt(self, complexity: str, concept: str, passage: str, batch_size: int) -> str:
        """Build vocabulary question prompt"""
        return f"""Generate exactly {batch_size} Grade 7 vocabulary questions using this passage.

CONCEPT: {concept}
COMPLEXITY: {complexity}
PASSAGE: {passage}

Create vocabulary questions that test word meaning in context.

JSON FORMAT:
{{
    "vocabulary_items": [
        {{
            "target_word": "word from passage",
            "question": "What does 'target_word' mean in this passage?",
            "options": {{"A": "definition1", "B": "definition2", "C": "definition3", "D": "definition4", "E": "definition5"}},
            "correct": "A",
            "explanation": "Why A is correct definition and context clues that help",
            "context_sentence": "Sentence containing the word"
        }}
    ]
}}"""
    
    def _build_comprehension_prompt(self, complexity: str, concept: str, passage: str, batch_size: int) -> str:
        """Build reading comprehension question prompt"""
        return f"""Generate exactly {batch_size} Grade 7 reading comprehension questions for this passage.

CONCEPT: {concept}
COMPLEXITY: {complexity}
PASSAGE: {passage}

Create comprehension questions that test understanding of the passage.

JSON FORMAT:
{{
    "comprehension_items": [
        {{
            "question": "Comprehension question about the passage",
            "options": {{"A": "option1", "B": "option2", "C": "option3", "D": "option4", "E": "option5"}},
            "correct": "B",
            "explanation": "Why B is correct with evidence from passage, why others wrong",
            "comprehension_skill": "{concept}"
        }}
    ]
}}"""
    
    def save_questions_to_supabase(self, questions: List[Dict], question_type: str, complexity: str, concept: str) -> int:
        """Save questions to database with proper schema compliance"""
        saved_count = 0
        
        for item in questions:
            try:
                # Generate hash
                content_for_hash = f"{item['question']}|{concept}|{question_type}"
                question_hash = self.generate_content_hash(content_for_hash)
                
                # Check existing
                existing = supabase.table('question_cache')\
                    .select('id')\
                    .eq('question_hash', question_hash)\
                    .execute()
                
                if existing.data:
                    continue
                
                # Format question data according to schema requirements
                question_data = {
                    "question": item['question'],  # Required
                    "options": item['options'],    # Required
                    "correct": item['correct'],    # Required by constraint
                    "explanation": item['explanation'],  # Required by constraint
                    f"{question_type}_concept": concept,
                    "question_type": question_type,
                    "grade_level": self.grade_level,
                    "complexity_level": complexity
                }
                
                # Add context for comprehension questions (required by constraint)
                if question_type == 'comprehension':
                    # Get the passage that was used for this question
                    passage_data = self.get_current_passage_for_context()
                    question_data["context"] = passage_data if passage_data else item.get('context', 'Generated passage context')
                
                # Add type-specific fields
                if 'context_sentence' in item:
                    question_data['context_sentence'] = item['context_sentence']
                if 'context_example' in item:
                    question_data['context_example'] = item['context_example']
                if 'base_word' in item:
                    question_data['base_word'] = item['base_word']
                if 'target_word' in item:
                    question_data['target_word'] = item['target_word']
                
                # Determine topic based on question type
                topic_mapping = {
                    'grammar': 'english_grammar',
                    'synonym': 'english_synonyms', 
                    'antonym': 'english_antonyms',
                    'vocabulary': 'english_vocabulary',
                    'comprehension': 'english_comprehension'
                }
                
                # Insert data
                insert_data = {
                    "topic": topic_mapping[question_type],
                    "difficulty": self.get_difficulty_rating(complexity),
                    "grade": self.grade_level,  # This will be 7
                    "question": question_data,
                    "ai_model": "gemini-2.5-flash",
                    "question_hash": question_hash
                }
                
                result = supabase.table('question_cache').insert(insert_data).execute()
                if result.data:
                    saved_count += 1
                    
            except Exception as e:
                print(f"      ❌ Failed to save question: {e}")
                continue
        
        if saved_count > 0:
            self.generation_stats['database_saves'] += saved_count
            print(f"   ✅ Saved {saved_count} {question_type} questions for {concept}")
        
        return saved_count
    
    def get_current_passage_for_context(self) -> str:
        """Get current passage text for context field"""
        if self.passage_pool and self.current_passage_index > 0:
            # Get the last used passage
            index = (self.current_passage_index - 1) % len(self.passage_pool)
            return self.passage_pool[index].get('text', 'Generated passage context')
        return 'Generated passage context'
    
    def generate_all_question_types(self, questions_per_concept: int = 10):
        """Generate all question types for all concepts"""
        
        if not self.initialize_system():
            return
        
        # Define all question types and their concepts
        question_configs = [
            ('grammar', [
                ('simple', SIMPLE_GRAMMAR_CONCEPTS),
                ('medium', MEDIUM_GRAMMAR_CONCEPTS),
                ('complex', COMPLEX_GRAMMAR_CONCEPTS)
            ]),
            ('synonym', [
                ('simple', SIMPLE_SYNONYM_CONCEPTS),
                ('medium', MEDIUM_SYNONYM_CONCEPTS),
                ('complex', COMPLEX_SYNONYM_CONCEPTS)
            ]),
            ('antonym', [
                ('simple', SIMPLE_ANTONYM_CONCEPTS),
                ('medium', MEDIUM_ANTONYM_CONCEPTS),
                ('complex', COMPLEX_ANTONYM_CONCEPTS)
            ]),
            ('vocabulary', [
                ('simple', SIMPLE_VOCABULARY_CONCEPTS),
                ('medium', MEDIUM_VOCABULARY_CONCEPTS),
                ('complex', COMPLEX_VOCABULARY_CONCEPTS)
            ]),
            ('comprehension', [
                ('simple', SIMPLE_COMPREHENSION_CONCEPTS),
                ('medium', MEDIUM_COMPREHENSION_CONCEPTS),
                ('complex', COMPLEX_COMPREHENSION_CONCEPTS)
            ])
        ]
        
        total_generated = 0
        
        # Process each question type
        for question_type, complexity_levels in question_configs:
            print(f"\n{'='*80}")
            print(f"📊 Generating {question_type.upper()} Questions")
            
            type_total = 0
            
            # Process each complexity level
            for complexity, concepts in complexity_levels:
                print(f"\n  📊 {complexity.upper()} level ({len(concepts)} concepts)")
                
                complexity_total = 0
                
                # Process each concept
                for concept_index, concept in enumerate(concepts, 1):
                    print(f"\n    📝 Concept {concept_index}/{len(concepts)}: {concept}")
                    
                    concept_total = 0
                    attempts = 0
                    
                    # Generate questions for this concept
                    while concept_total < questions_per_concept and attempts < MAX_BATCH_ATTEMPTS:
                        attempts += 1
                        remaining = questions_per_concept - concept_total
                        batch_size = min(5, remaining)
                        
                        print(f"      🔄 Attempt {attempts}: generating {batch_size} questions")
                        
                        questions = self.generate_questions_batch(
                            question_type, complexity, concept, batch_size
                        )
                        
                        if questions:
                            saved = self.save_questions_to_supabase(
                                questions, question_type, complexity, concept
                            )
                            concept_total += saved
                        else:
                            print(f"      ❌ Generation failed")
                    
                    print(f"      ✅ Generated {concept_total} questions for {concept}")
                    complexity_total += concept_total
                
                print(f"    📊 {complexity} total: {complexity_total}")
                type_total += complexity_total
            
            print(f"  📊 {question_type.upper()} total: {type_total}")
            total_generated += type_total
        
        # Print final statistics
        self._print_final_stats(total_generated)
    
    def _print_final_stats(self, total_generated: int):
        """Print comprehensive final statistics"""
        stats = self.generation_stats
        
        print(f"\n{'='*80}")
        print("🎉 GRADE 7 UNIFIED GENERATION COMPLETE!")
        print(f"{'='*80}")
        
        print("📊 GENERATION STATISTICS:")
        print(f"   ✅ Total questions generated: {total_generated}")
        print(f"   📝 Grammar questions: {stats['grammar_generated']}")
        print(f"   🔄 Synonym questions: {stats['synonym_generated']}")
        print(f"   ↔️  Antonym questions: {stats['antonym_generated']}")
        print(f"   📖 Vocabulary questions: {stats['vocabulary_generated']}")
        print(f"   📚 Comprehension questions: {stats['comprehension_generated']}")
        
        print(f"\n🔍 QUALITY ASSURANCE:")
        print(f"   🔄 Total attempts: {stats['total_attempts']}")
        print(f"   ✅ Successful generations: {stats['successful_generations']}")
        print(f"   ❌ Failed generations: {stats['failed_generations']}")
        print(f"   ⚠️  Duplicates rejected: {stats['duplicates_rejected']}")
        print(f"   🛡️  Content safety blocks: {stats['content_safety_blocks']}")
        print(f"   💾 Database saves: {stats['database_saves']}")
        
        if stats['total_attempts'] > 0:
            success_rate = (stats['successful_generations'] / stats['total_attempts']) * 100
            print(f"   📈 Success rate: {success_rate:.1f}%")
        
        print(f"\n✅ Grade 7 unified question generator completed successfully!")

# ============================================================================
# MAIN EXECUTION
# ============================================================================
def main():
    """Main execution function"""
    print("🎓 GRADE 7 UNIFIED QUESTION GENERATOR")
    print("="*60)
    print("🚀 Generating ALL question types from URL passages...")
    print(f"📅 Session start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    print("\n📋 QUESTION TYPES:")
    print("   📝 Grammar questions (contextual analysis)")
    print("   🔄 Synonym questions (from passage vocabulary)")
    print("   ↔️  Antonym questions (from passage vocabulary)")
    print("   📖 Vocabulary questions (meaning in context)")
    print("   📚 Reading comprehension questions")
    
    try:
        generator = Grade7UnifiedGenerator()
        generator.generate_all_question_types(questions_per_concept=10)
        
        print(f"\n🎉 GENERATION COMPLETED!")
        print(f"⏰ Session completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
    except Exception as e:
        print(f"\n❌ Critical error: {e}")

if __name__ == "__main__":
    main()