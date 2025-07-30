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

# **FIXED CONSTANTS**: Strict retry limits to prevent excessive duplicate checks
FUZZY_SIMILARITY_THRESHOLD = 0.85  # 85% similarity triggers duplicate detection
MAX_BATCH_ATTEMPTS = 2  # **CRITICAL**: Maximum 2 attempts per batch (ENFORCED)
MAX_CONCEPT_FAILURES = 2  # Maximum failed concepts before moving to next complexity

# **DYNAMIC TOPIC GENERATION CONFIG**: AI-powered topic expansion
ENABLE_DYNAMIC_TOPICS = True  # Toggle dynamic topic generation
TOPICS_PER_COMPLEXITY = 30  # Base number of topics per complexity level
DYNAMIC_TOPICS_MULTIPLIER = 2  # Generate 2x more topics dynamically

# Educational Standards-Based Synonym Concepts (BASE SET - will be expanded dynamically)
SIMPLE_SYNONYMS = [
    # Basic emotions and feelings (Grades 3-5 TEKS, CA Standards)
    "curious_inquisitive_emotions", "bored_uninterested_feelings", "proud_pleased_emotions", "ashamed_embarrassed_feelings",
    "grateful_thankful_emotions", "jealous_envious_feelings", "brave_courageous_emotions", "shy_timid_feelings",
    "hopeful_optimistic_emotions", "disappointed_let_down_feelings", "confused_puzzled_emotions", "confident_sure_feelings",
    "frustrated_annoyed_emotions", "content_satisfied_feelings", "lonely_isolated_emotions", "cheerful_upbeat_feelings",
    
    # Physical descriptions and appearances (ISEE Lower Level)
    "rough_bumpy_texture", "smooth_sleek_texture", "sharp_pointed_edge", "dull_blunt_edge",
    "thick_dense_consistency", "thin_slender_consistency", "strong_powerful_strength", "weak_fragile_strength",
    "firm_solid_hardness", "soft_gentle_texture", "round_circular_shape", "square_rectangular_shape",
    "crooked_bent_alignment", "straight_direct_alignment", "full_complete_capacity", "empty_vacant_capacity"
]

MEDIUM_SYNONYMS = [
    # Academic skills and learning (Middle School TEKS, ISEE Middle Level)
    "master_excel_proficiency", "struggle_difficulty_challenge", "practice_rehearse_preparation", "neglect_ignore_avoidance",
    "focus_concentrate_attention", "distract_divert_attention", "memorize_retain_learning", "review_revisit_study",
    "research_investigate_inquiry", "discover_find_exploration", "identify_recognize_recognition", "classify_categorize_organization",
    "apply_implement_usage", "demonstrate_show_exhibition", "interpret_explain_understanding", "summarize_condense_brevity",
    
    # Communication and language (CA Language Arts Standards)
    "clarify_elucidate_explanation", "convince_persuade_influence", "inform_notify_communication", "entertain_amuse_engagement",
    "express_convey_communication", "listen_hear_reception", "respond_reply_interaction", "question_inquire_curiosity",
    "compliment_praise_appreciation", "criticize_evaluate_judgment", "interrupt_intervene_disruption", "continue_proceed_progression"
]

COMPLEX_SYNONYMS = [
    # Advanced academic vocabulary (High School TEKS, Pre-SAT)
    "comprehensive_thorough_completeness", "cursory_superficial_inadequacy", "elaborate_detailed_complexity", "succinct_concise_brevity",
    "systematic_organized_methodology", "chaotic_disorganized_confusion", "consistent_uniform_reliability", "erratic_unpredictable_inconsistency",
    "innovative_creative_originality", "conventional_traditional_conformity", "sophisticated_refined_complexity", "primitive_basic_simplicity",
    "precise_exact_accuracy", "approximate_rough_estimation", "definitive_conclusive_certainty", "tentative_provisional_uncertainty",
    
    # Scientific and technical reasoning (Advanced Science TEKS)
    "empirical_observational_evidence", "theoretical_conceptual_abstraction", "quantitative_numerical_measurement", "qualitative_descriptive_characteristics",
    "systematic_methodical_organization", "random_arbitrary_chance", "controlled_regulated_management", "spontaneous_natural_occurrence"
]

class TopicExpansionEngine:
    """**NEW**: AI-powered dynamic topic generation to scale beyond hardcoded lists"""
    
    def __init__(self):
        # **Cache for generated topics**: Prevents regenerating same topics multiple times
        self.topic_cache = {
            'simple': [],
            'medium': [],
            'complex': []
        }
        self.cache_loaded = False
    
    def generate_dynamic_topics(self, complexity: str, base_topics: List[str], target_count: int) -> List[str]:
        """
        **CORE FUNCTION**: Generate additional topics using AI to expand beyond hardcoded concepts
        
        Args:
            complexity: 'simple', 'medium', or 'complex'
            base_topics: Existing hardcoded topics list
            target_count: Total number of topics needed
            
        Returns:
            Extended list of topics (base + AI-generated)
        """
        
        # **Early return if enough topics**: Don't generate if we already have sufficient
        if len(base_topics) >= target_count:
            print(f"   📝 Using existing {len(base_topics)} {complexity} topics (sufficient)")
            return base_topics[:target_count]
        
        # **Check cache first**: Avoid regenerating topics if already cached
        if self.topic_cache[complexity]:
            combined = base_topics + self.topic_cache[complexity]
            print(f"   📝 Using cached topics: {len(base_topics)} base + {len(self.topic_cache[complexity])} cached = {len(combined)} total")
            return combined[:target_count]
        
        # **Calculate how many to generate**: Only generate what's needed
        needed_topics = target_count - len(base_topics)
        
        print(f"   🤖 Generating {needed_topics} additional {complexity} synonym topics...")
        
        # **Grade-specific complexity guidance**: Tailor AI generation to educational level
        complexity_guidance = {
            'simple': "elementary/middle school level, basic everyday vocabulary, common emotions and descriptions",
            'medium': "middle/high school level, academic vocabulary, analytical thinking terms",
            'complex': "advanced high school/pre-college level, sophisticated academic terms, specialized vocabulary"
        }
        
        # **Educational standards context**: Ensure AI follows educational guidelines
        educational_context = """
        Base generation on these educational standards:
        - ISEE Test Preparation vocabulary lists
        - Texas Essential Knowledge and Skills (TEKS) 
        - California State Language Arts Standards
        - Pre-SAT academic word lists
        - Common Core vocabulary progressions
        """
        
        # **AI prompt for topic generation**: Structured prompt for consistent output
        prompt = f"""You are an expert educational content creator specializing in synonym vocabulary development.

TASK: Generate exactly {needed_topics} NEW synonym concept topics for {complexity} level.

COMPLEXITY LEVEL: {complexity}
COMPLEXITY GUIDANCE: {complexity_guidance[complexity]}

{educational_context}

EXISTING TOPICS TO AVOID (do not duplicate these):
{', '.join(base_topics)}

REQUIREMENTS:
1. Each topic should focus on a specific synonym relationship category
2. Topics should be educationally appropriate for {complexity} level
3. Follow the naming pattern: "word1_word2_category" (e.g., "happy_joyful_emotions")
4. Cover diverse vocabulary domains (emotions, actions, descriptions, academic terms)
5. Ensure topics align with educational standards mentioned above

OUTPUT FORMAT (JSON):
{{
    "topics": [
        "generated_topic_1",
        "generated_topic_2",
        // ... exactly {needed_topics} topics
    ]
}}

Generate exactly {needed_topics} unique, educationally-aligned synonym topics."""

        try:
            # **Generate AI response**: Get new topics from AI
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            # **Parse AI response**: Extract JSON from response
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
            
            content = json.loads(response_text)
            
            # **Validate and extract topics**: Ensure AI returned proper format
            if 'topics' in content and isinstance(content['topics'], list):
                new_topics = content['topics'][:needed_topics]  # Limit to requested count
                
                # **Cache the generated topics**: Store for future use
                self.topic_cache[complexity] = new_topics
                
                # **Combine base + generated**: Create final topic list
                extended_topics = base_topics + new_topics
                
                print(f"   ✅ Generated {len(new_topics)} new {complexity} topics successfully")
                print(f"   📊 Total topics available: {len(extended_topics)} ({len(base_topics)} base + {len(new_topics)} generated)")
                
                return extended_topics[:target_count]
            else:
                # **Fallback on AI failure**: Use base topics if AI generation fails
                print(f"   ⚠️  AI topic generation failed, using base {len(base_topics)} topics only")
                return base_topics
                
        except Exception as e:
            # **Error handling**: Log error and fallback to base topics
            print(f"   ❌ Topic generation error: {e}")
            print(f"   📝 Falling back to base {len(base_topics)} topics")
            return base_topics

class SynonymDuplicateDetector:
    """**ENHANCED**: Robust duplicate detection with improved performance and caching"""
    
    def __init__(self):
        # **Primary duplicate tracking**: Core sets for fast lookup
        self.existing_base_words: Set[str] = set()
        self.existing_questions: Set[str] = set()
        
        # **Performance optimization**: Track loading status to avoid redundant DB calls
        self.loaded = False
        
        # **Statistics tracking**: Monitor duplicate detection performance
        self.detection_stats = {
            'total_checks': 0,
            'duplicates_found': 0,
            'load_time': 0
        }
        
    def load_existing_synonyms(self):
        """
        **OPTIMIZED**: Load all existing synonym questions with performance tracking
        Only loads once to avoid repeated expensive DB calls
        """
        
        # **Skip if already loaded**: Prevent redundant database calls
        if self.loaded:
            print(f"   📋 Duplicate detector already loaded ({len(self.existing_base_words)} words cached)")
            return
            
        try:
            # **Performance tracking**: Monitor how long DB load takes
            start_time = time.time()
            print("🔍 Loading existing synonyms for duplicate detection...")
            
            # **Database query**: Get all existing synonym questions efficiently
            result = supabase.table('question_cache')\
                .select('question')\
                .eq('topic', 'english_synonyms')\
                .not_.is_('question', 'null')\
                .execute()
            
            # **Process results**: Extract words and questions for duplicate checking
            for record in result.data:
                # **Extract base words**: Get the primary word being tested
                if record['question'] and 'base_word' in record['question']:
                    base_word = record['question']['base_word'].lower()
                    self.existing_base_words.add(base_word)
                    
                # **Extract question text**: Get full question for duplicate detection
                if record['question'] and 'question' in record['question']:
                    question_text = record['question']['question'].lower()
                    self.existing_questions.add(question_text)
            
            # **Performance tracking**: Record load statistics
            self.detection_stats['load_time'] = time.time() - start_time
            self.loaded = True
            
            print(f"✅ Loaded {len(self.existing_base_words)} existing base words for comparison")
            print(f"   ⏱️  Load time: {self.detection_stats['load_time']:.2f} seconds")
            
        except Exception as e:
            # **Error handling**: Initialize empty sets on failure to prevent crashes
            print(f"⚠️  Failed to load existing synonyms: {e}")
            self.existing_base_words = set()
            self.existing_questions = set()
            self.loaded = True  # Mark as loaded to prevent retry loops
    
    def is_duplicate(self, base_word: str, question: str) -> Tuple[bool, str]:
        """
        **FAST DUPLICATE CHECK**: O(1) lookup with detailed reasoning
        
        Args:
            base_word: The primary word being tested
            question: The full question text
            
        Returns:
            Tuple of (is_duplicate: bool, reason: str)
        """
        
        # **Performance tracking**: Count total duplicate checks performed
        self.detection_stats['total_checks'] += 1
        
        # **Primary duplicate check**: Check if base word already exists
        if base_word.lower() in self.existing_base_words:
            self.detection_stats['duplicates_found'] += 1
            return True, f"Base word '{base_word}' already exists"
        
        # **Question duplicate check**: Check if exact question already exists
        if question.lower() in self.existing_questions:
            self.detection_stats['duplicates_found'] += 1
            return True, f"Question already exists"
            
        # **Not a duplicate**: Word and question are unique
        return False, "Unique synonym item"
    
    def add_word(self, base_word: str, question: str):
        """
        **IMMEDIATE TRACKING**: Add new word to prevent intra-batch duplicates
        This prevents the same word from being generated multiple times in one batch
        """
        self.existing_base_words.add(base_word.lower())
        self.existing_questions.add(question.lower())

class ISEESynonymGenerator:
    """**PRODUCTION-READY**: Enhanced synonym generator with strict retry limits and dynamic topics"""
    
    def __init__(self):
        # **Core components**: Initialize detection and topic expansion
        self.duplicate_detector = SynonymDuplicateDetector()
        self.topic_engine = TopicExpansionEngine()
        
        # **Comprehensive statistics**: Track all aspects of generation process
        self.generation_stats = {
            'total_attempts': 0,           # Total AI generation attempts
            'duplicates_rejected': 0,      # Items rejected due to duplicates
            'successful_generations': 0,   # Items successfully saved to DB
            'failed_generations': 0,       # Failed AI generation attempts
            'batch_retries': 0,           # Number of batch retries performed
            'concepts_skipped': 0,        # Concepts skipped due to failures
            'topics_expanded': 0          # Topics added via dynamic generation
        }
        
    def initialize_system(self):
        """
        **SYSTEM INITIALIZATION**: Setup all components with error handling
        Returns True if system ready, False if critical failure
        """
        print("🚀 Initializing ISEE Synonym Generator (Production Version)...")
        
        try:
            # **Load duplicate detection**: Essential for preventing duplicates
            self.duplicate_detector.load_existing_synonyms()
            
            # **Initialize topic expansion**: Prepare dynamic topic generation
            if ENABLE_DYNAMIC_TOPICS:
                print(f"🤖 Dynamic topic generation enabled (targeting {TOPICS_PER_COMPLEXITY}+ topics per complexity)")
            
            print("✅ System initialization completed successfully")
            return True
            
        except Exception as e:
            # **Critical failure handling**: Log error and abort
            print(f"❌ System initialization failed: {e}")
            return False
        
    def generate_content_hash(self, content: str) -> str:
        """
        **UNIQUE IDENTIFICATION**: Generate SHA-256 hash for duplicate detection in database
        Used to prevent duplicate entries at the database level
        """
        return hashlib.sha256(content.encode()).hexdigest()
    
    def get_expanded_topics(self, complexity: str, base_topics: List[str]) -> List[str]:
        """
        **TOPIC EXPANSION**: Get extended topic list using dynamic generation
        
        Args:
            complexity: Difficulty level ('simple', 'medium', 'complex')
            base_topics: Hardcoded topic list
            
        Returns:
            Extended topic list (base + dynamically generated)
        """
        
        # **Skip expansion if disabled**: Use only base topics
        if not ENABLE_DYNAMIC_TOPICS:
            return base_topics
        
        # **Calculate target topic count**: How many topics we want total
        target_count = TOPICS_PER_COMPLEXITY * DYNAMIC_TOPICS_MULTIPLIER
        
        # **Generate expanded topics**: Use AI to create additional topics
        expanded_topics = self.topic_engine.generate_dynamic_topics(
            complexity, base_topics, target_count
        )
        
        # **Track expansion statistics**: Monitor how many topics were added
        added_count = len(expanded_topics) - len(base_topics)
        if added_count > 0:
            self.generation_stats['topics_expanded'] += added_count
        
        return expanded_topics
    
    def generate_synonym_batch(self, grade: int, complexity: str, concept: str, batch_size: int = 10) -> Optional[List[Dict]]:
        """
        **CORE GENERATION**: Generate batch of synonym questions with strict duplicate avoidance
        
        Args:
            grade: Target grade level (5-9)
            complexity: Difficulty level
            concept: Specific synonym concept/topic
            batch_size: Number of questions to generate
            
        Returns:
            List of valid synonym questions or None if generation failed
        """
        
        # **Track generation attempt**: Increment attempt counter
        self.generation_stats['total_attempts'] += 1
        
        # **Aggressive duplicate avoidance**: Get sample of existing words to exclude
        avoid_words = list(self.duplicate_detector.existing_base_words)
        random.shuffle(avoid_words)  # Randomize to show different examples each time
        
        # **Build exclusion text**: Create string of words to avoid for AI prompt
        existing_words_text = f"""
CRITICAL DUPLICATE AVOIDANCE INSTRUCTIONS:
- You MUST NOT use any of these words as base words: {', '.join(avoid_words[:25])}
- Generate completely NEW and DIFFERENT words for the concept: {concept}
- Use more advanced vocabulary appropriate for grade {grade}
- Each base word must be UNIQUE and NOT appear in the avoid list above
""" if avoid_words else ""
        
        # **Educational standards alignment**: Ensure AI follows proper educational guidelines
        educational_standards = f"""
EDUCATIONAL STANDARDS ALIGNMENT:
- ISEE {complexity.title()} Level vocabulary
- {"Elementary" if grade <= 5 else "Middle School" if grade <= 8 else "High School"} TEKS Standards
- California State Board Language Arts Standards
- Pre-SAT vocabulary preparation
"""
        
        # **Comprehensive AI prompt**: Detailed instructions for quality generation
        prompt = f"""You are an expert ISEE test prep content creator specializing in synonym questions.

TASK: Generate exactly {batch_size} UNIQUE synonym questions for grade {grade} students.

SYNONYM CONCEPT: {concept}
COMPLEXITY LEVEL: {complexity}
GRADE LEVEL: {grade}

{existing_words_text}

{educational_standards}

CRITICAL REQUIREMENTS:
1. Each base word must be COMPLETELY UNIQUE - never used before
2. Use advanced vocabulary appropriate for grade {grade} level
3. Focus specifically on {concept} synonym relationships
4. Generate words that are NOT commonly used in basic vocabulary lists
5. Ensure educational standards alignment

REQUIRED JSON STRUCTURE:
{{
    "synonym_items": [
        {{
            "base_word": "exemplary",
            "part_of_speech": "adjective", 
            "question": "Which word is most similar in meaning to 'exemplary'?",
            "options": {{
                "A": "poor",
                "B": "outstanding", 
                "C": "average",
                "D": "excellent",
                "E": "typical"
            }},
            "correct": "B",
            "explanation": "B is correct because 'outstanding' means exceptionally good, which is similar to 'exemplary' (serving as a desirable model). A is incorrect as it's the opposite. C and E are incorrect as they indicate mediocrity. D is very close but 'excellent' suggests high quality while 'exemplary' specifically means serving as a model worth imitating.",
            "context_example": "The student's exemplary behavior earned praise from teachers."
        }}
        // ... {batch_size - 1} more items
    ],
    "concept": "{concept}",
    "grade": {grade}
}}

IMPORTANT GENERATION RULES:
- Generate exactly {batch_size} synonym items
- Each base word must be different and sophisticated
- Create exactly 5 options (A, B, C, D, E) for each question
- Include one correct synonym and four distractors:
  * One VERY CLOSE synonym that's almost correct but has subtle difference
  * One clear antonym (opposite meaning)
  * Two other plausible but incorrect options
- The close distractor should test nuanced understanding of word meaning
- Use context examples that demonstrate advanced usage
- Provide clear explanations for all 5 options, especially the close distractor
- Focus on vocabulary that challenges grade {grade} students appropriately"""

        try:
            # **AI generation call**: Request content from AI model
            response = model.generate_content(prompt)
            
            # **Response parsing**: Extract and clean JSON from AI response
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
                
            content = json.loads(response_text)
            
            # **Structure validation**: Ensure AI returned expected format
            if 'synonym_items' not in content:
                raise ValueError("Missing synonym_items in response")
                
            if len(content['synonym_items']) != batch_size:
                raise ValueError(f"Expected {batch_size} items, got {len(content['synonym_items'])}")
            
            # **Item validation with strict duplicate checking**: Process each generated item
            valid_items = []
            for item in content['synonym_items']:
                # **Required field check**: Ensure all necessary fields present
                required_fields = ['base_word', 'question', 'options', 'correct', 'explanation']
                if all(field in item for field in required_fields):
                    
                    # **Duplicate detection**: Check against existing words and questions
                    is_duplicate, reason = self.duplicate_detector.is_duplicate(
                        item['base_word'],
                        item['question']
                    )
                    
                    if not is_duplicate:
                        # **Accept valid item**: Add to valid list and track immediately
                        valid_items.append(item)
                        # **Immediate tracking**: Prevent duplicates within this batch
                        self.duplicate_detector.add_word(item['base_word'], item['question'])
                    else:
                        # **Reject duplicate**: Log rejection and update statistics
                        print(f"⚠️  Skipping duplicate: {reason}")
                        self.generation_stats['duplicates_rejected'] += 1
            
            # **Return validation results**: Provide valid items or None if insufficient
            if valid_items:
                print(f"✅ Generated {len(valid_items)} valid synonym items for {concept} (Grade {grade})")
                return valid_items
            else:
                print(f"❌ No valid items generated for {concept} - all were duplicates")
                return None
                
        except Exception as e:
            # **Generation failure handling**: Log error and update statistics
            print(f"❌ Synonym generation failed: {e}")
            self.generation_stats['failed_generations'] += 1
            return None
    
    def save_synonyms_to_supabase(self, synonym_items: List[Dict], grade: int, difficulty: int, concept: str) -> int:
        """
        **DATABASE PERSISTENCE**: Save valid synonym questions to Supabase with duplicate protection
        
        Args:
            synonym_items: List of validated synonym questions
            grade: Grade level
            difficulty: Difficulty rating
            concept: Synonym concept/topic
            
        Returns:
            Number of items successfully saved
        """
        
        saved_count = 0
        
        # **Process each item**: Save individually with error handling
        for item in synonym_items:
            try:
                # **Generate unique hash**: Create identifier for duplicate detection
                content_for_hash = f"{item['base_word']}|{item['question']}|{item['correct']}"
                question_hash = self.generate_content_hash(content_for_hash)
                
                # **Database duplicate check**: Verify hash doesn't already exist
                existing = supabase.table('question_cache')\
                    .select('id')\
                    .eq('question_hash', question_hash)\
                    .execute()
                
                # **Skip if duplicate found**: Don't save duplicate entries
                if existing.data:
                    continue
                
                # **Build standardized question structure**: Format for database storage
                question_data = {
                    "base_word": item['base_word'],
                    "part_of_speech": item.get('part_of_speech', 'word'),
                    "question": item['question'],
                    "options": item['options'],
                    "correct": item['correct'],
                    "explanation": item['explanation'],
                    "context_example": item.get('context_example', ''),
                    "synonym_concept": concept
                }
                
                # **Database insertion**: Save to Supabase with metadata
                insert_data = {
                    "topic": "english_synonyms",
                    "difficulty": difficulty,
                    "grade": grade,
                    "question": question_data,
                    "ai_model": "gemini-2.5-flash",
                    "question_hash": question_hash
                }
                
                # **Execute save**: Insert into database
                result = supabase.table('question_cache').insert(insert_data).execute()
                saved_count += 1
                
                # **Update duplicate detector**: Add to tracking to prevent future duplicates
                self.duplicate_detector.add_word(item['base_word'], item['question'])
                
            except Exception as e:
                # **Save error handling**: Log but continue with other items
                print(f"❌ Failed to save synonym item: {e}")
                
        # **Update statistics and provide feedback**: Track successful saves
        if saved_count > 0:
            self.generation_stats['successful_generations'] += saved_count
            print(f"✅ Saved {saved_count} synonym items for {concept} (Grade {grade})")
            
        return saved_count
    
    def generate_synonyms_for_all_grades(self):
        """
        **MAIN EXECUTION**: Generate 100 synonym questions for each grade and complexity combination
        **CRITICAL FIX**: Implements strict 2-attempt limit per batch to prevent excessive retries
        """
        
        # **System initialization check**: Ensure system is ready
        if not self.initialize_system():
            print("❌ Failed to initialize system")
            return
        
        # **Define generation matrix**: Grades and complexity levels to process
        grades = [9, 8, 7, 6, 5]  # **REVERSED ORDER**: Start with highest grade for better vocabulary
        
        # **Get expanded topic lists**: Use dynamic generation if enabled
        simple_topics = self.get_expanded_topics("simple", SIMPLE_SYNONYMS)
        medium_topics = self.get_expanded_topics("medium", MEDIUM_SYNONYMS)
        complex_topics = self.get_expanded_topics("complex", COMPLEX_SYNONYMS)
        
        complexities = [
            ("medium", medium_topics),
            ("complex", complex_topics)
            # **NOTE**: Removed simple to focus on medium and complex only
        ]
        
        total_generated = 0
        
        # **Grade processing loop**: Process each grade level
        for grade in grades:
            print(f"\n📚 Processing Grade {grade}")
            
            # **Complexity processing loop**: Process each complexity level
            for complexity_name, concept_list in complexities:
                print(f"\n  📊 Complexity: {complexity_name.upper()} ({len(concept_list)} total concepts)")
                
                # **Calculate distribution**: How to divide 100 questions among concepts
                words_per_concept = 100 // len(concept_list)
                remaining_words = 100 % len(concept_list)
                
                grade_complexity_total = 0
                concepts_failed = 0  # **Track failed concepts for this complexity**
                
                # **Concept processing loop**: Process each individual concept
                for i, concept in enumerate(concept_list):
                    
                    # **Early termination check**: Stop if too many concepts fail
                    if concepts_failed >= MAX_CONCEPT_FAILURES:
                        print(f"      ⏭️  Stopping after {MAX_CONCEPT_FAILURES} failed concepts")
                        break
                    
                    # **Calculate target for this concept**: Distribute extra words to early concepts
                    target_words = words_per_concept + (1 if i < remaining_words else 0)
                    
                    print(f"\n    📝 Concept: {concept} (Target: {target_words} words)")
                    
                    # **Determine difficulty rating**: Map complexity to numeric difficulty
                    if complexity_name == "medium":
                        difficulty = 5
                    else:  # complex
                        difficulty = 7
                    
                    # **Batch generation loop with STRICT limits**: Generate in batches of 10
                    concept_total = 0
                    concept_attempts = 0  # **Track attempts for this specific concept**
                    
                    while concept_total < target_words and concept_attempts < MAX_CONCEPT_FAILURES:
                        # **Calculate batch size**: Don't exceed remaining target
                        batch_size = min(10, target_words - concept_total)
                        
                        # **CRITICAL FIX**: Strict 2-attempt limit per batch
                        batch_success = False
                        for attempt in range(1, MAX_BATCH_ATTEMPTS + 1):  # **ENFORCED**: Maximum 2 attempts
                            
                            print(f"        🔄 Batch attempt {attempt}/{MAX_BATCH_ATTEMPTS} for {concept}")
                            
                            # **Generate batch**: Attempt to create synonym questions
                            synonym_items = self.generate_synonym_batch(
                                grade, complexity_name, concept, batch_size
                            )
                            
                            # **Check batch success**: Process if valid items generated
                            if synonym_items and len(synonym_items) > 0:
                                # **Save to database**: Persist generated questions
                                saved = self.save_synonyms_to_supabase(
                                    synonym_items, grade, difficulty, concept
                                )
                                concept_total += saved
                                batch_success = True
                                
                                print(f"        ✅ Batch successful: {saved} items saved")
                                break  # **Exit retry loop on success**
                            else:
                                # **Batch failed**: Log failure and continue to next attempt
                                print(f"        ❌ Batch attempt {attempt} failed for {concept}")
                                self.generation_stats['batch_retries'] += 1
                                
                                # **Brief delay between attempts**: Prevent rapid retries
                                if attempt < MAX_BATCH_ATTEMPTS:
                                    time.sleep(0.5)
                        
                        # **Check if all batch attempts failed**: Increment concept failure counter
                        if not batch_success:
                            concept_attempts += 1
                            print(f"        ⚠️  All {MAX_BATCH_ATTEMPTS} batch attempts failed, concept attempt {concept_attempts}/{MAX_CONCEPT_FAILURES}")
                    
                    # **Concept completion**: Track results and failures
                    if concept_total == 0:
                        concepts_failed += 1
                        self.generation_stats['concepts_skipped'] += 1
                        print(f"      ❌ Concept failed completely: {concept}")
                    else:
                        print(f"      ✅ Generated {concept_total} synonym questions for {concept}")
                    
                    grade_complexity_total += concept_total
                
                # **Complexity completion summary**: Report results for this grade/complexity
                print(f"\n  ✅ Total for Grade {grade} {complexity_name}: {grade_complexity_total} synonym questions")
                print(f"     📊 Concepts failed: {concepts_failed}/{len(concept_list)}")
                total_generated += grade_complexity_total
        
        # **Final statistics**: Print comprehensive results
        self._print_generation_stats(total_generated)
    
    def _print_generation_stats(self, total_generated: int):
        """
        **COMPREHENSIVE REPORTING**: Print detailed statistics about the generation process
        Helps monitor performance and identify optimization opportunities
        """
        stats = self.generation_stats
        
        print(f"\n🎉 Synonym generation complete!")
        print(f"📊 GENERATION STATISTICS:")
        print(f"   Total synonym questions generated: {total_generated}")
        print(f"   Total generation attempts: {stats['total_attempts']}")
        print(f"   Successful generations: {stats['successful_generations']}")
        print(f"   Duplicates rejected: {stats['duplicates_rejected']}")
        print(f"   Failed generations: {stats['failed_generations']}")
        print(f"   Batch retries performed: {stats['batch_retries']}")
        print(f"   Concepts skipped due to failures: {stats['concepts_skipped']}")
        print(f"   Topics added via dynamic expansion: {stats['topics_expanded']}")
        
        # **Calculate success rates**: Provide performance metrics
        if stats['total_attempts'] > 0:
            success_rate = (stats['successful_generations'] / (stats['successful_generations'] + stats['failed_generations'])) * 100 if (stats['successful_generations'] + stats['failed_generations']) > 0 else 0
            print(f"   Success rate: {success_rate:.1f}%")
            
        # **Duplicate detection performance**: Show duplicate detection statistics
        detection_stats = self.duplicate_detector.detection_stats
        if detection_stats['total_checks'] > 0:
            duplicate_rate = (detection_stats['duplicates_found'] / detection_stats['total_checks']) * 100
            print(f"   Duplicate detection rate: {duplicate_rate:.1f}% ({detection_stats['duplicates_found']}/{detection_stats['total_checks']})")

def main():
    """
    **MAIN EXECUTION FUNCTION**: Entry point for the synonym generation system
    """
    generator = ISEESynonymGenerator()
    
    print("🔧 ISEE Synonym Generator Starting (Production Version)...")
    print(f"📚 Generating synonym questions aligned with educational standards:")
    print(f"   • ISEE Test Preparation Vocabulary")
    print(f"   • Pre-SAT Academic Word Lists") 
    print(f"   • Texas Essential Knowledge and Skills (TEKS)")
    print(f"   • California State Board Language Arts Standards")
    print(f"🛡️  Enhanced duplicate detection with strict retry limits")
    print(f"🚀 PRODUCTION FIXES:")
    print(f"   • Maximum {MAX_BATCH_ATTEMPTS} attempts per batch (ENFORCED)")
    print(f"   • Maximum {MAX_CONCEPT_FAILURES} concept failures before moving on")
    print(f"   • Dynamic topic expansion: {TOPICS_PER_COMPLEXITY}+ topics per complexity")
    print(f"   • Reverse grade order (9→5) for advanced vocabulary generation")
    print(f"🤖 Dynamic topic generation: {'ENABLED' if ENABLE_DYNAMIC_TOPICS else 'DISABLED'}")
    
    # **Execute main generation process**: Generate synonyms for all grade/complexity combinations
    generator.generate_synonyms_for_all_grades()
    
    print("\n✅ All operations completed successfully!")

if __name__ == "__main__":
    main()