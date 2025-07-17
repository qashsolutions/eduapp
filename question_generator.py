import os
import json
import hashlib
import random
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import google.generativeai as genai
from supabase import create_client, Client
from dataclasses import dataclass

# Configuration
@dataclass
class Config:
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY') 
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    
    # Grammar concepts by complexity
    SIMPLE_GRAMMAR = [
        "subject_verb_agreement_simple",
        "basic_prepositional_phrases"
    ]
    
    MEDIUM_GRAMMAR = [
        "subject_verb_agreement_compound", 
        "subject_verb_agreement_indefinite_pronouns",
        "adjective_clauses_restrictive",
        "gerunds_basic"
    ]
    
    COMPLEX_GRAMMAR = [
        "adjective_clauses_nonrestrictive",
        "adverb_clauses",
        "noun_clauses", 
        "infinitives_advanced"
    ]

# Initialize clients
config = Config()

# Debug environment variables
print("🔍 Debug - Environment Variables:")
print(f"SUPABASE_URL: {config.SUPABASE_URL}")
print(f"SUPABASE_KEY: {config.SUPABASE_KEY and config.SUPABASE_KEY[:20] + '...'}")
print(f"GEMINI_API_KEY: {config.GEMINI_API_KEY and config.GEMINI_API_KEY[:20] + '...'}")

if not config.SUPABASE_URL:
    print("❌ SUPABASE_URL is missing!")
    exit(1)
if not config.SUPABASE_KEY:
    print("❌ SUPABASE_KEY is missing!")
    exit(1)
if not config.GEMINI_API_KEY:
    print("❌ GEMINI_API_KEY is missing!")
    exit(1)

genai.configure(api_key=config.GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')
supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

class ISEEQuestionGenerator:
    def __init__(self):
        self.conversation_history = []
        self.used_themes = set()
        self.used_passages = set()
        
    def fix_existing_schema(self):
        """Standardize all existing questions to consistent 5-option format"""
        
        print("🔧 Fixing existing question_cache schema...")
        
        try:
            # Use direct update instead of SQL RPC
            # Get all questions that need fixing
            questions_to_fix = supabase.table('question_cache')\
                .select('*')\
                .is_('expires_at', 'null')\
                .execute()
            
            fixed_count = 0
            
            for question in questions_to_fix.data:
                old_question = question['question']
                
                # Build new standardized format
                new_question = {
                    "context": old_question.get('context', ''),
                    "question": old_question.get('question', old_question.get('question_text', '')),
                    "options": {
                        "A": self._get_option(old_question, 0, 'A'),
                        "B": self._get_option(old_question, 1, 'B'), 
                        "C": self._get_option(old_question, 2, 'C'),
                        "D": self._get_option(old_question, 3, 'D'),
                        "E": "None of the above"
                    },
                    "correct": self._get_correct_answer(old_question),
                    "explanation": old_question.get('explanation', ''),
                    "grammar_concept": self._assign_grammar_concept(question['topic']),
                    "question_type": old_question.get('question_type', 'multiple_choice')
                }
                
                # Update the question
                supabase.table('question_cache')\
                    .update({'question': new_question})\
                    .eq('id', question['id'])\
                    .execute()
                
                fixed_count += 1
                if fixed_count % 100 == 0:
                    print(f"   Fixed {fixed_count} questions...")
            
            print(f"✅ Schema standardization completed - Fixed {fixed_count} questions")
            
        except Exception as e:
            print(f"❌ Schema fix failed: {e}")
    
    def _get_option(self, question_data, index, letter):
        """Helper to extract option from old format"""
        if 'options' in question_data:
            if isinstance(question_data['options'], list):
                return question_data['options'][index] if index < len(question_data['options']) else f"Option {letter}"
            elif isinstance(question_data['options'], dict):
                return question_data['options'].get(letter, f"Option {letter}")
        return f"Option {letter}"
    
    def _get_correct_answer(self, question_data):
        """Helper to determine correct answer"""
        if 'correct' in question_data:
            return question_data['correct']
        
        if 'correct_answer' in question_data:
            correct_text = question_data['correct_answer']
            if 'options' in question_data:
                if isinstance(question_data['options'], list):
                    for i, option in enumerate(question_data['options']):
                        if option == correct_text:
                            return chr(65 + i)  # Convert to A, B, C, D
                elif isinstance(question_data['options'], dict):
                    for letter, option in question_data['options'].items():
                        if option == correct_text:
                            return letter
        
        return 'A'  # Default fallback
    
    def _assign_grammar_concept(self, topic):
        """Assign default grammar concept based on topic"""
        if topic == 'english_grammar':
            return 'subject_verb_agreement_simple'
        elif topic == 'english_comprehension':
            return 'reading_comprehension'
        else:
            return 'vocabulary_context'
    
    def generate_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash for duplicate detection"""
        return hashlib.sha256(content.encode()).hexdigest()
    
    def get_grammar_concepts_for_grade(self, grade: int) -> List[str]:
        """Get appropriate grammar concepts based on grade and complexity distribution"""
        if grade in [5, 6]:
            # 70% simple, 30% medium
            concepts = (config.SIMPLE_GRAMMAR * 7) + (config.MEDIUM_GRAMMAR * 3)
        elif grade in [7, 8]:
            # 40% simple, 30% medium, 30% complex  
            concepts = (config.SIMPLE_GRAMMAR * 4) + (config.MEDIUM_GRAMMAR * 3) + (config.COMPLEX_GRAMMAR * 3)
        else:  # grade 9
            # 50% medium, 50% complex
            concepts = (config.MEDIUM_GRAMMAR * 5) + (config.COMPLEX_GRAMMAR * 5)
        
        return concepts
    
    def build_context_prompt(self, previous_passages: List[str]) -> str:
        """Build context to prevent repetition"""
        if not previous_passages:
            return ""
        
        context = "IMPORTANT: Do not repeat these themes or create similar passages:\n"
        for i, passage in enumerate(previous_passages[-5:], 1):  # Last 5 passages
            context += f"{i}. {passage[:100]}...\n"
        context += "\nEnsure your new passage is completely different in theme, setting, and content.\n\n"
        return context
        
    def generate_isee_passage_set(self, topic: str, category: str, grade: int, difficulty: str) -> Optional[Dict]:
        """Generate a complete ISEE passage with 5 questions focusing on grammar integration"""
        
        # Get appropriate grammar concept
        grammar_concepts = self.get_grammar_concepts_for_grade(grade)
        grammar_concept = random.choice(grammar_concepts)
        
        # Build anti-repetition context
        context_prompt = self.build_context_prompt(list(self.used_passages))
        
        # Grade-appropriate vocabulary complexity
        vocab_level = {
            5: "elementary vocabulary (ages 10-11)",
            6: "late elementary vocabulary (ages 11-12)", 
            7: "middle school vocabulary (ages 12-13)",
            8: "advanced middle school vocabulary (ages 13-14)",
            9: "early high school vocabulary (ages 14-15)"
        }
        
        prompt = f"""{context_prompt}

You are an expert ISEE test prep content creator. Generate a reading comprehension passage with exactly 5 questions.

PASSAGE REQUIREMENTS:
- Topic: {topic} ({category})
- Length: 250-280 words exactly
- Grade level: {grade} (use {vocab_level[grade]})
- Difficulty: {difficulty}
- MUST deliberately include examples of: {grammar_concept}
- Include rich vocabulary appropriate for ISEE testing
- Make the content engaging and educational

QUESTION REQUIREMENTS:
Generate exactly 5 questions in this order:
1. Main Idea (identify central theme/purpose)
2. Supporting Details (specific facts from passage) 
3. Inference (draw conclusions from implied information)
4. Vocabulary in Context (word meaning using passage clues)
5. Grammar Focus (explicitly test {grammar_concept})

ANSWER CHOICE RULES:
- Each question must have exactly 5 options (A, B, C, D, E)
- One option should be very close to correct but wrong
- Include plausible distractors that test understanding
- Make option E substantive, not just "None of the above"

GRAMMAR CONCEPT DEFINITIONS:
- subject_verb_agreement_simple: Basic singular/plural matching
- subject_verb_agreement_compound: "The dog and cat run" vs "runs"  
- subject_verb_agreement_indefinite_pronouns: "Everyone has" vs "have"
- adjective_clauses_restrictive: "Students who study hard succeed" (no commas)
- adjective_clauses_nonrestrictive: "My teacher, who is kind, helps us" (with commas)
- adverb_clauses: "When it rains, we stay inside" (time, cause, condition)
- noun_clauses: "What he said was important" (clause as subject/object)
- infinitives_advanced: "To succeed requires dedication" (complex usage)
- gerunds_basic: "Swimming is fun" (verb as noun)
- basic_prepositional_phrases: "The book on the table" (location, time)

Return your response as a JSON object with this exact structure:
{{
    "passage": "Full 250-280 word passage text here",
    "questions": [
        {{
            "question_type": "main_idea",
            "question": "What is the main idea of this passage?",
            "options": {{
                "A": "option text",
                "B": "option text", 
                "C": "option text",
                "D": "option text",
                "E": "option text"
            }},
            "correct": "B",
            "explanation": "Detailed explanation"
        }},
        // ... 4 more questions following the pattern
    ],
    "grammar_concept": "{grammar_concept}",
    "passage_theme": "brief description for tracking"
}}

CRITICAL: Make each passage completely unique. Avoid repeating themes, settings, or similar content structures."""

        try:
            # Generate content with conversation tracking
            self.conversation_history.append(prompt)
            response = model.generate_content(prompt)
            
            # Parse response
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
                
            content = json.loads(response_text)
            
            # Validate structure
            required_fields = ['passage', 'questions', 'grammar_concept', 'passage_theme']
            if not all(field in content for field in required_fields):
                raise ValueError(f"Missing required fields: {required_fields}")
                
            if len(content['questions']) != 5:
                raise ValueError(f"Expected 5 questions, got {len(content['questions'])}")
                
            # Check for duplicates
            passage_hash = self.generate_content_hash(content['passage'])
            if passage_hash in self.used_passages:
                print(f"⚠️  Duplicate passage detected, regenerating...")
                return self.generate_isee_passage_set(topic, category, grade, difficulty)
            
            # Track usage
            self.used_passages.add(passage_hash)
            self.used_themes.add(content['passage_theme'])
            
            return content
            
        except Exception as e:
            print(f"❌ Generation failed for {topic} (Grade {grade}): {e}")
            return None
    
    def save_questions_to_supabase(self, passage_content: Dict, topic_category: str, grade: int, difficulty_num: int) -> bool:
        """Save generated questions to Supabase with proper schema"""
        
        try:
            passage_text = passage_content['passage']
            questions = passage_content['questions']
            grammar_concept = passage_content['grammar_concept']
            
            # Save each question separately
            for i, q in enumerate(questions):
                # Build standardized question structure
                question_data = {
                    "context": passage_text,
                    "question": q['question'],
                    "options": q['options'],
                    "correct": q['correct'], 
                    "explanation": q['explanation'],
                    "grammar_concept": grammar_concept,
                    "question_type": q.get('question_type', f'question_{i+1}')
                }
                
                # Generate unique hash
                content_for_hash = f"{passage_text}|{q['question']}|{q['correct']}"
                question_hash = self.generate_content_hash(content_for_hash)
                
                # Insert to Supabase
                insert_data = {
                    "topic": "english_comprehension", 
                    "difficulty": difficulty_num,
                    "grade": grade,
                    "question": question_data,
                    "ai_model": "gemini-1.5-flash",
                    "mood": "focused",
                    "question_hash": question_hash
                }
                
                result = supabase.table('question_cache').insert(insert_data).execute()
                print(f"✅ Saved question {i+1}/5 for {topic_category} (Grade {grade})")
                
            return True
            
        except Exception as e:
            print(f"❌ Failed to save questions: {e}")
            return False
    
    def generate_batch_content(self, num_passages_per_grade: int = 2):
        """Generate batch content for all grades and topics"""
        
        # Topic mappings by grade
        topics_by_grade = {
            5: [
                ("The Life of a Honeybee", "Science", "simple"),
                ("The History of the Ice Cream Cone", "Social Studies", "simple"),
                ("A Day in the Life of an Astronaut", "Science", "simple"),
                ("Biography of an Inventor: Thomas Edison", "Humanities", "medium"),
                ("The Rules of Basketball", "Social Studies", "medium")
            ],
            6: [
                ("The Grand Canyon: A Geological Wonder", "Science", "simple"),
                ("The Story of the First Thanksgiving", "Social Studies", "simple"), 
                ("The Ancient Roman Colosseum", "Social Studies", "medium"),
                ("Biography of a Famous Artist: Vincent van Gogh", "Humanities", "medium"),
                ("The Journey of a Salmon", "Science", "medium")
            ],
            7: [
                ("The Silk Road and Its Impact", "Social Studies", "simple"),
                ("The Civil Rights Movement", "Social Studies", "medium"),
                ("The American Revolution", "Social Studies", "medium"),
                ("The Harlem Renaissance", "Humanities", "complex"),
                ("The Theory of Continental Drift", "Science", "complex")
            ],
            8: [
                ("The Principles of Gravity", "Science", "simple"),
                ("The Formation of Earthquakes", "Science", "medium"),
                ("The Works of William Shakespeare", "Humanities", "medium"),
                ("The Industrial Revolution", "Social Studies", "complex"),
                ("The Great Depression", "Social Studies", "complex")
            ],
            9: [
                ("The Science of Climate Change", "Science", "medium"),
                ("The Development of the US Constitution", "Social Studies", "medium"),
                ("Quantum Mechanics for Beginners", "Science", "complex"),
                ("The Economic Impact of Globalization", "Social Studies", "complex"),
                ("Existentialism in Modern Literature", "Humanities", "complex")
            ]
        }
        
        print(f"🚀 Starting batch generation: {num_passages_per_grade} passages per grade")
        
        total_generated = 0
        
        for grade in range(5, 10):
            print(f"\n📚 Generating content for Grade {grade}")
            
            topics = topics_by_grade[grade]
            selected_topics = random.sample(topics, min(num_passages_per_grade, len(topics)))
            
            for topic, category, difficulty in selected_topics:
                print(f"  📝 Creating passage: {topic}")
                
                # Map difficulty to number
                difficulty_map = {"simple": 3, "medium": 5, "complex": 7}
                difficulty_num = difficulty_map[difficulty]
                
                # Generate passage set
                content = self.generate_isee_passage_set(topic, category, grade, difficulty)
                
                if content:
                    # Save to database
                    if self.save_questions_to_supabase(content, f"{topic}_{category}", grade, difficulty_num):
                        total_generated += 5  # 5 questions per passage
                        print(f"    ✅ Generated 5 questions successfully")
                    else:
                        print(f"    ❌ Failed to save questions")
                else:
                    print(f"    ❌ Failed to generate content")
        
        print(f"\n🎉 Batch generation complete! Total questions generated: {total_generated}")

def main():
    """Main execution function"""
    generator = ISEEQuestionGenerator()
    
    print("🔧 ISEE Question Generator Starting...")
    
    # Step 1: Fix existing schema
    generator.fix_existing_schema()
    
    # Step 2: Generate new content
    print("\n📚 Generating new ISEE content...")
    generator.generate_batch_content(num_passages_per_grade=3)
    
    print("\n✅ All operations completed successfully!")

if __name__ == "__main__":
    main()