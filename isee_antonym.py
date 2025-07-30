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

# Educational Standards-Based Antonym Concepts (200+ variations)
# Based on ISEE, Pre-SAT, TEKS, and California State Standards
# Removed original concepts to prevent duplicates

SIMPLE_ANTONYMS = [
    # Basic spatial and directional opposites (Grades 3-5 TEKS, CA Standards)
    "high_low_elevation", "front_back_position", "left_right_direction", "near_far_distance",
    "inside_outside_location", "above_below_position", "forward_backward_direction", "here_there_location",
    "top_bottom_position", "center_edge_location", "north_south_direction", "east_west_direction",
    "upward_downward_movement", "inward_outward_movement", "toward_away_direction", "close_distant_proximity",
    
    # Physical qualities and conditions (ISEE Lower Level)
    "heavy_light_weight", "wide_narrow_width", "deep_shallow_depth", "long_short_length",
    "tall_short_height", "thick_thin_dimension", "large_small_size", "huge_tiny_size",
    "strong_weak_strength", "firm_soft_texture", "hard_soft_consistency", "solid_liquid_state",
    "rough_smooth_surface", "sharp_dull_edge", "pointed_blunt_tip", "curved_straight_shape",
    
    # Time and temporal concepts (Elementary TEKS)
    "early_late_timing", "first_last_sequence", "beginning_end_sequence", "start_finish_process",
    "before_after_time", "past_future_time", "yesterday_tomorrow_time", "morning_evening_time",
    "sunrise_sunset_time", "dawn_dusk_time", "daytime_nighttime_period", "weekday_weekend_time",
    "young_old_age", "new_ancient_age", "fresh_stale_condition", "modern_outdated_era",
    
    # Basic emotional and behavioral opposites (CA Elementary Standards)
    "happy_sad_emotion", "calm_excited_emotion", "brave_scared_emotion", "kind_mean_behavior",
    "gentle_rough_manner", "polite_rude_behavior", "friendly_unfriendly_attitude", "helpful_harmful_behavior",
    "honest_dishonest_character", "generous_selfish_character", "patient_impatient_temperament", "careful_careless_behavior",
    "quiet_noisy_behavior", "active_inactive_energy", "awake_asleep_consciousness", "alert_drowsy_awareness"
]

MEDIUM_ANTONYMS = [
    # Academic and intellectual opposites (Middle School TEKS, ISEE Middle Level)
    "intelligent_ignorant_intellect", "wise_foolish_judgment", "knowledgeable_uninformed_education", "educated_uneducated_learning",
    "skilled_unskilled_ability", "talented_untalented_capability", "experienced_inexperienced_expertise", "competent_incompetent_ability",
    "logical_illogical_reasoning", "rational_irrational_thinking", "reasonable_unreasonable_judgment", "sensible_nonsensical_wisdom",
    "clear_confusing_clarity", "obvious_obscure_clarity", "simple_complicated_complexity", "easy_difficult_challenge",
    
    # Social and interpersonal opposites (CA Language Arts Standards)
    "popular_unpopular_status", "famous_unknown_recognition", "included_excluded_social_status", "welcomed_rejected_reception",
    "trusted_distrusted_reliability", "respected_disrespected_regard", "admired_despised_opinion", "praised_criticized_evaluation",
    "encouraged_discouraged_motivation", "supported_opposed_assistance", "defended_attacked_protection", "united_divided_solidarity",
    "cooperative_competitive_interaction", "agreeable_disagreeable_personality", "diplomatic_confrontational_approach", "peaceful_hostile_disposition",
    
    # Action and behavior opposites (Pre-SAT Vocabulary)
    "construct_demolish_action", "create_destroy_production", "build_tear_down_construction", "assemble_dismantle_organization",
    "organize_disorganize_structure", "arrange_scatter_order", "gather_disperse_collection", "collect_distribute_accumulation",
    "advance_retreat_movement", "approach_withdraw_direction", "attack_defend_strategy", "pursue_flee_chase",
    "expand_contract_size", "increase_decrease_quantity", "multiply_divide_mathematics", "add_subtract_arithmetic",
    
    # Character and moral opposites (Middle School Social Studies TEKS)
    "courageous_cowardly_bravery", "confident_insecure_self_assurance", "optimistic_pessimistic_outlook", "hopeful_hopeless_attitude",
    "determined_uncertain_resolve", "persistent_quitting_perseverance", "diligent_lazy_work_ethic", "responsible_irresponsible_accountability",
    "reliable_unreliable_dependability", "loyal_disloyal_allegiance", "faithful_unfaithful_commitment", "devoted_indifferent_dedication",
    "humble_arrogant_attitude", "modest_boastful_demeanor", "sincere_insincere_authenticity", "genuine_fake_authenticity",
    
    # Problem-solving and decision-making (ISEE Reasoning)
    "solution_problem_resolution", "answer_question_response", "success_failure_outcome", "victory_defeat_result",
    "achievement_disappointment_accomplishment", "progress_regression_development", "improvement_deterioration_change", "advancement_setback_movement",
    "efficient_wasteful_productivity", "productive_unproductive_output", "effective_ineffective_impact", "useful_useless_utility",
    "beneficial_harmful_effect", "positive_negative_impact", "constructive_destructive_influence", "helpful_hindering_assistance"
]

COMPLEX_ANTONYMS = [
    # Advanced academic and intellectual opposites (High School TEKS, Pre-SAT)
    "comprehensive_superficial_depth", "thorough_cursory_completeness", "meticulous_careless_attention", "precise_imprecise_accuracy",
    "systematic_chaotic_organization", "methodical_haphazard_approach", "deliberate_spontaneous_intention", "calculated_impulsive_planning",
    "sophisticated_primitive_complexity", "refined_crude_development", "elegant_clumsy_grace", "polished_rough_finish",
    "articulate_inarticulate_communication", "eloquent_stammering_speech", "fluent_hesitant_expression", "coherent_incoherent_logic",
    
    # Scientific and analytical opposites (Advanced Science TEKS)
    "empirical_theoretical_evidence", "objective_subjective_perspective", "quantitative_qualitative_measurement", "systematic_random_methodology",
    "controlled_uncontrolled_experiment", "precise_approximate_measurement", "accurate_inaccurate_correctness", "reliable_unreliable_consistency",
    "significant_negligible_importance", "substantial_minimal_magnitude", "extensive_limited_scope", "comprehensive_partial_coverage",
    "innovative_conventional_approach", "progressive_conservative_ideology", "modern_archaic_time_period", "contemporary_obsolete_relevance",
    
    # Literary and linguistic opposites (High School English TEKS)
    "explicit_implicit_clarity", "literal_metaphorical_interpretation", "concrete_abstract_nature", "specific_general_precision",
    "formal_informal_style", "academic_colloquial_register", "scholarly_popular_level", "technical_layman_complexity",
    "verbose_laconic_expression", "elaborate_concise_detail", "expansive_compressed_scope", "detailed_summary_thoroughness",
    "persuasive_unconvincing_effectiveness", "compelling_weak_influence", "authoritative_questionable_credibility", "definitive_tentative_certainty",
    
    # Philosophical and abstract opposites (Pre-College Level)
    "absolute_relative_nature", "universal_particular_scope", "eternal_temporal_duration", "infinite_finite_limitation",
    "transcendent_mundane_level", "spiritual_material_realm", "idealistic_pragmatic_approach", "theoretical_practical_application",
    "intrinsic_extrinsic_origin", "inherent_acquired_nature", "natural_artificial_source", "organic_synthetic_composition",
    "authentic_counterfeit_genuineness", "original_imitation_authenticity", "genuine_fabricated_truth", "real_fictitious_existence",
    
    # Advanced social and political opposites (AP History, Government)
    "democratic_authoritarian_governance", "liberal_conservative_ideology", "progressive_reactionary_orientation", "radical_moderate_position",
    "inclusive_exclusive_policy", "egalitarian_hierarchical_structure", "collaborative_competitive_approach", "cooperative_adversarial_relationship",
    "transparent_secretive_openness", "public_private_accessibility", "collective_individual_focus", "communal_personal_ownership",
    "diplomatic_confrontational_strategy", "peaceful_aggressive_approach", "harmonious_discordant_relationship", "unified_fragmented_condition",
    
    # Psychological and behavioral opposites (Psychology, Advanced Literature)
    "extroverted_introverted_personality", "gregarious_solitary_social_preference", "outgoing_withdrawn_behavior", "sociable_reclusive_tendency",
    "confident_insecure_self_perception", "assertive_passive_behavior", "dominant_submissive_interaction", "independent_dependent_autonomy",
    "resilient_vulnerable_strength", "adaptable_rigid_flexibility", "optimistic_pessimistic_outlook", "positive_negative_attitude",
    "empathetic_apathetic_emotional_response", "compassionate_indifferent_caring", "altruistic_selfish_motivation", "benevolent_malevolent_intention",
    
    # Economic and business opposites (Advanced Social Studies)
    "profitable_unprofitable_outcome", "successful_unsuccessful_result", "prosperous_impoverished_condition", "wealthy_destitute_status",
    "abundant_scarce_availability", "plentiful_limited_quantity", "surplus_deficit_balance", "excess_shortage_supply",
    "efficient_inefficient_productivity", "cost_effective_wasteful_economics", "sustainable_unsustainable_viability", "stable_volatile_condition",
    "expanding_contracting_growth", "developing_declining_progress", "thriving_struggling_condition", "flourishing_failing_success",
    
    # Cultural and anthropological opposites (Advanced Social Studies)
    "cosmopolitan_provincial_perspective", "worldly_parochial_outlook", "sophisticated_unsophisticated_refinement", "cultured_uncultured_development",
    "diverse_homogeneous_composition", "multicultural_monocultural_variety", "heterogeneous_uniform_mixture", "varied_consistent_nature",
    "traditional_modern_orientation", "conventional_unconventional_approach", "orthodox_unorthodox_conformity", "established_experimental_status",
    "indigenous_foreign_origin", "native_alien_belonging", "domestic_international_scope", "local_global_reach"
]

class AntonymDuplicateDetector:
    """Robust duplicate detection for antonym questions"""
    
    def __init__(self):
        self.existing_base_words: Set[str] = set()
        self.existing_questions: Set[str] = set()
        
    def load_existing_antonyms(self):
        """Load all existing antonym questions for comparison"""
        try:
            print("🔍 Loading existing antonyms for duplicate detection...")
            
            # Get all existing antonym questions
            result = supabase.table('question_cache')\
                .select('question')\
                .eq('topic', 'english_antonyms')\
                .not_.is_('question', 'null')\
                .execute()
            
            for record in result.data:
                if record['question'] and 'base_word' in record['question']:
                    base_word = record['question']['base_word'].lower()
                    self.existing_base_words.add(base_word)
                if record['question'] and 'question' in record['question']:
                    question_text = record['question']['question'].lower()
                    self.existing_questions.add(question_text)
            
            print(f"✅ Loaded {len(self.existing_base_words)} existing base words for comparison")
            
        except Exception as e:
            print(f"⚠️  Failed to load existing antonyms: {e}")
            self.existing_base_words = set()
            self.existing_questions = set()
    
    def is_duplicate(self, base_word: str, question: str) -> Tuple[bool, str]:
        """Check if base word or question is duplicate"""
        if base_word.lower() in self.existing_base_words:
            return True, f"Base word '{base_word}' already exists"
        
        if question.lower() in self.existing_questions:
            return True, f"Question already exists"
            
        return False, "Unique antonym item"
    
    def add_word(self, base_word: str, question: str):
        """Add new word to tracking"""
        self.existing_base_words.add(base_word.lower())
        self.existing_questions.add(question.lower())

class ISEEAntonymGenerator:
    def __init__(self):
        self.duplicate_detector = AntonymDuplicateDetector()
        self.generation_stats = {
            'total_attempts': 0,
            'duplicates_rejected': 0,
            'successful_generations': 0,
            'failed_generations': 0
        }
        
    def initialize_system(self):
        """Initialize the antonym generation system"""
        print("🚀 Initializing ISEE Antonym Generator...")
        
        # Load duplicate detection
        self.duplicate_detector.load_existing_antonyms()
        return True
        
    def generate_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash for duplicate detection"""
        return hashlib.sha256(content.encode()).hexdigest()
    
    def get_difficulty_for_antonym_concept(self, antonym_concept: str) -> int:
        """Assign difficulty level based on antonym concept complexity"""
        if antonym_concept in SIMPLE_ANTONYMS:
            return 3
        elif antonym_concept in MEDIUM_ANTONYMS:
            return 5
        else:
            return 7
    
    def generate_antonym_batch(self, grade: int, complexity: str, concept: str, batch_size: int = 10) -> Optional[List[Dict]]:
        """Generate a batch of antonym questions"""
        
        self.generation_stats['total_attempts'] += 1
        
        # Add existing words to avoid duplicates
        existing_words_text = f"AVOID THESE ALREADY USED WORDS: {', '.join(list(self.duplicate_detector.existing_base_words)[:50])}" if self.duplicate_detector.existing_base_words else ""
        
        prompt = f"""You are an expert ISEE test prep content creator specializing in antonym questions.

TASK: Generate exactly {batch_size} antonym questions for grade {grade} students.

ANTONYM CONCEPT: {concept}
COMPLEXITY LEVEL: {complexity}
GRADE LEVEL: {grade}

{existing_words_text}

EDUCATIONAL STANDARDS ALIGNMENT:
- ISEE {complexity.title()} Level vocabulary
- {"Elementary" if grade <= 5 else "Middle School" if grade <= 8 else "High School"} TEKS Standards
- California State Board Language Arts Standards
- Pre-SAT vocabulary preparation

CRITICAL REQUIREMENTS:
1. Each base word must be unique
2. Words should be appropriate for grade {grade} level
3. Focus on {concept} antonym type
4. Each question tests antonym recognition
5. Align with educational standards for vocabulary development

REQUIRED JSON STRUCTURE:
{{
    "antonym_items": [
        {{
            "base_word": "benevolent",
            "part_of_speech": "adjective",
            "question": "Which word is most opposite in meaning to 'benevolent'?",
            "options": {{
                "A": "kind",
                "B": "generous",
                "C": "malevolent",
                "D": "neutral"
            }},
            "correct": "C",
            "explanation": "C is correct because 'malevolent' means having or showing a wish to do evil to others, which is the opposite of 'benevolent' (well-meaning and kindly). A and B are incorrect as they are synonyms of benevolent. D is incorrect as neutral is not a direct opposite.",
            "context_example": "The benevolent donor gave millions to charity."
        }}
        // ... {batch_size - 1} more items
    ],
    "concept": "{concept}",
    "grade": {grade}
}}

IMPORTANT:
- Generate exactly {batch_size} antonym items
- Each base word must be different
- Include one clear antonym (correct answer) and three plausible distractors
- At least one distractor should be a synonym or similar word
- Context examples should demonstrate the word's usage
- Explanations should clarify why each option is correct or incorrect
- Ensure vocabulary complexity matches grade level and educational standards"""

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
            if 'antonym_items' not in content:
                raise ValueError("Missing antonym_items in response")
                
            if len(content['antonym_items']) != batch_size:
                raise ValueError(f"Expected {batch_size} items, got {len(content['antonym_items'])}")
            
            # Validate each item
            valid_items = []
            for item in content['antonym_items']:
                required_fields = ['base_word', 'question', 'options', 'correct', 'explanation']
                if all(field in item for field in required_fields):
                    # Check for duplicates
                    is_duplicate, reason = self.duplicate_detector.is_duplicate(
                        item['base_word'],
                        item['question']
                    )
                    
                    if not is_duplicate:
                        valid_items.append(item)
                    else:
                        print(f"⚠️  Skipping duplicate: {reason}")
                        self.generation_stats['duplicates_rejected'] += 1
            
            if valid_items:
                print(f"✅ Generated {len(valid_items)} valid antonym items for {concept} (Grade {grade})")
                return valid_items
            else:
                return None
                
        except Exception as e:
            print(f"❌ Antonym generation failed: {e}")
            self.generation_stats['failed_generations'] += 1
            return None
    
    def save_antonyms_to_supabase(self, antonym_items: List[Dict], grade: int, difficulty: int, concept: str) -> int:
        """Save generated antonyms to Supabase"""
        
        saved_count = 0
        
        for item in antonym_items:
            try:
                # Generate unique hash
                content_for_hash = f"{item['base_word']}|{item['question']}|{item['correct']}"
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
                    "base_word": item['base_word'],
                    "part_of_speech": item.get('part_of_speech', 'word'),
                    "question": item['question'],
                    "options": item['options'],
                    "correct": item['correct'],
                    "explanation": item['explanation'],
                    "context_example": item.get('context_example', ''),
                    "antonym_concept": concept
                }
                
                # Insert to Supabase
                insert_data = {
                    "topic": "english_antonyms",
                    "difficulty": difficulty,
                    "grade": grade,
                    "question": question_data,
                    "ai_model": "gemini-2.5-flash",
                    "question_hash": question_hash
                }
                
                result = supabase.table('question_cache').insert(insert_data).execute()
                saved_count += 1
                
                # Add to duplicate detector
                self.duplicate_detector.add_word(item['base_word'], item['question'])
                
            except Exception as e:
                print(f"❌ Failed to save antonym item: {e}")
                
        if saved_count > 0:
            self.generation_stats['successful_generations'] += saved_count
            print(f"✅ Saved {saved_count} antonym items for {concept} (Grade {grade})")
            
        return saved_count
    
    def generate_antonyms_for_all_grades(self):
        """Generate 100 antonym questions for each grade and complexity combination"""
        
        if not self.initialize_system():
            print("❌ Failed to initialize system")
            return
        
        # Define the combinations
        grades = [5, 6, 7, 8, 9]
        complexities = [
            ("simple", SIMPLE_ANTONYMS),
            ("medium", MEDIUM_ANTONYMS),
            ("complex", COMPLEX_ANTONYMS)
        ]
        
        total_generated = 0
        
        # Process each grade
        for grade in grades:
            print(f"\n📚 Processing Grade {grade}")
            
            # Process each complexity level
            for complexity_name, concept_list in complexities:
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
                        difficulty = 3
                    elif complexity_name == "medium":
                        difficulty = 5
                    else:
                        difficulty = 7
                    
                    # Generate in batches of 10
                    concept_total = 0
                    while concept_total < target_words:
                        batch_size = min(10, target_words - concept_total)
                        
                        # Generate with retry logic
                        for attempt in range(1, 2):
                            antonym_items = self.generate_antonym_batch(
                                grade, complexity_name, concept, batch_size
                            )
                            
                            if antonym_items:
                                saved = self.save_antonyms_to_supabase(
                                    antonym_items, grade, difficulty, concept
                                )
                                concept_total += saved
                                break
                            
                            # Add delay between retries
                            if attempt < MAX_RETRIES_PER_TOPIC:
                                time.sleep(1)
                    
                    grade_complexity_total += concept_total
                    print(f"      Generated {concept_total} antonym questions for {concept}")
                
                print(f"\n  ✅ Total for Grade {grade} {complexity_name}: {grade_complexity_total} antonym questions")
                total_generated += grade_complexity_total
        
        # Print final statistics
        self._print_generation_stats(total_generated)
    
    def _print_generation_stats(self, total_generated: int):
        """Print comprehensive generation statistics"""
        stats = self.generation_stats
        
        print(f"\n🎉 Antonym generation complete!")
        print(f"📊 GENERATION STATISTICS:")
        print(f"   Total antonym questions generated: {total_generated}")
        print(f"   Total generation attempts: {stats['total_attempts']}")
        print(f"   Successful generations: {stats['successful_generations']}")
        print(f"   Duplicates rejected: {stats['duplicates_rejected']}")
        print(f"   Failed generations: {stats['failed_generations']}")
        
        if stats['total_attempts'] > 0:
            success_rate = (stats['successful_generations'] / (stats['successful_generations'] + stats['failed_generations'])) * 100 if (stats['successful_generations'] + stats['failed_generations']) > 0 else 0
            print(f"   Success rate: {success_rate:.1f}%")

def main():
    """Main execution function"""
    generator = ISEEAntonymGenerator()
    
    print("🔧 ISEE Antonym Generator Starting...")
    print(f"📚 Generating antonym questions aligned with educational standards:")
    print(f"   • ISEE Test Preparation Vocabulary")
    print(f"   • Pre-SAT Academic Word Lists")
    print(f"   • Texas Essential Knowledge and Skills (TEKS)")
    print(f"   • California State Board Language Arts Standards")
    print(f"🛡️  Duplicate detection enabled")
    print(f"📊 Enhanced concept library: {len(SIMPLE_ANTONYMS) + len(MEDIUM_ANTONYMS) + len(COMPLEX_ANTONYMS)} total concepts")
    
    # Generate antonyms for all grade/complexity combinations
    generator.generate_antonyms_for_all_grades()
    
    print("\n✅ All operations completed successfully!")

if __name__ == "__main__":
    main()
