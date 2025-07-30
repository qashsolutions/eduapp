import os
import json
import hashlib
import random
import re
import requests
import csv
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

# Initialize clients - EXACTLY like isee_synonym.py
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# CONSTANTS
MAX_PASSAGE_ATTEMPTS = 3  # Maximum attempts to extract passage from URL
MAX_QUESTION_ATTEMPTS = 2  # Maximum attempts to generate questions
FUZZY_SIMILARITY_THRESHOLD = 0.75  # 75% similarity triggers duplicate detection
SKIP_AFTER_FAILURES = 2  # Skip passage after 2 consecutive failures

# Grade-specific word counts
GRADE_WORD_COUNTS = {
    5: (200, 250),
    6: (250, 300),
    7: (300, 350),
    8: (350, 400),
    9: (350, 500)
}

class ReadingComprehensionGenerator:
    """Main class for generating reading comprehension questions using Gemini only"""
    
    def __init__(self):
        self.passage_duplicate_detector = PassageDuplicateDetector()
        self.statistics = {
            'total_urls_processed': 0,
            'passages_extracted': 0,
            'passages_rejected_duplicates': 0,
            'questions_generated': 0,
            'passages_failed': 0,
            'passages_saved': 0,
            'gemini_calls': 0,
            'total_cost': 0.0
        }
        
    def main_workflow(self, input_source: str):
        """
        MAIN WORKFLOW: Step-by-step process for generating reading comprehension
        """
        print("🚀 Starting Reading Comprehension Generation Workflow")
        print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🤖 Using Gemini 2.5 Flash for all generation tasks")
        
        # STEP 1: Load and validate input sources
        print("\n📝 STEP 1: Loading and validating input sources...")
        urls = self.load_input_sources(input_source)
        if not urls:
            print("❌ No valid URLs found")
            return
        print(f"✅ Loaded {len(urls)} URLs to process")
        
        # Initialize duplicate detection
        print("\n🔍 Initializing duplicate detection system...")
        self.passage_duplicate_detector.load_existing_passages()
        
        # Process each URL
        for url_index, url in enumerate(urls, 1):
            print(f"\n{'='*60}")
            print(f"📌 Processing URL {url_index}/{len(urls)}: {url}")
            self.statistics['total_urls_processed'] += 1
            
            # STEP 2: Fetch content from URL
            print(f"\n📥 STEP 2: Fetching content from URL...")
            content = self.fetch_url_content(url)
            if not content:
                print("❌ Failed to fetch content, skipping URL")
                continue
            print(f"✅ Fetched {len(content)} characters of content")
            
            # Process for each grade
            for grade in [5, 6, 7, 8, 9]:
                print(f"\n📚 Processing for Grade {grade}")
                min_words, max_words = GRADE_WORD_COUNTS[grade]
                print(f"   Target word count: {min_words}-{max_words} words")
                
                passage_attempts = 0
                passage_failures = 0
                
                # Try to generate multiple passages per URL/grade
                for passage_num in range(3):  # Try to get 3 passages per URL per grade
                    if passage_failures >= SKIP_AFTER_FAILURES:
                        print(f"   ⏭️ Skipping after {SKIP_AFTER_FAILURES} consecutive failures")
                        break
                    
                    print(f"\n   📄 Attempting passage {passage_num + 1}/3 for Grade {grade}")
                    
                    # STEP 3: Extract passage using Gemini
                    print(f"   📤 STEP 3: Extracting passage with Gemini...")
                    passage_data = self.extract_passage_with_gemini(
                        content, grade, min_words, max_words, 
                        passage_num, url
                    )
                    
                    if not passage_data:
                        print("   ❌ Failed to extract passage")
                        passage_failures += 1
                        continue
                    
                    print(f"   ✅ Extracted passage: {len(passage_data['text'].split())} words")
                    self.statistics['passages_extracted'] += 1
                    
                    # STEP 4: Check for duplicates
                    print(f"   🔍 STEP 4: Checking for duplicates...")
                    is_duplicate, reason = self.passage_duplicate_detector.is_duplicate(
                        passage_data['text'], passage_data['theme']
                    )
                    
                    if is_duplicate:
                        print(f"   ⚠️ Duplicate detected: {reason}")
                        self.statistics['passages_rejected_duplicates'] += 1
                        passage_failures += 1
                        continue
                    
                    print("   ✅ Passage is unique")
                    
                    # STEP 5: Generate questions
                    print(f"   📝 STEP 5: Generating questions...")
                    question_attempts = 0
                    questions_generated = False
                    
                    while question_attempts < MAX_QUESTION_ATTEMPTS and not questions_generated:
                        question_attempts += 1
                        print(f"      Attempt {question_attempts}/{MAX_QUESTION_ATTEMPTS}")
                        
                        # Generate all questions with Gemini
                        print(f"      🤖 Generating all questions with Gemini...")
                        all_questions = self.generate_all_questions_gemini(
                            passage_data['text'], grade
                        )
                        
                        if not all_questions:
                            print("      ❌ Failed to generate questions")
                            continue
                        print(f"   ✅ Generated {len(all_questions)} questions")
                        self.statistics['questions_generated'] += len(all_questions)
                        
                        # STEP 6: Validate answers
                        print(f"   ✔️ STEP 6: Validating answers...")
                        validation_passed = self.validate_all_answers(all_questions)
                        
                        if not validation_passed:
                            print("   ❌ Answer validation failed")
                            continue
                        
                        print("   ✅ All answers validated successfully")
                        questions_generated = True
                        
                        # STEP 7: Save to Supabase
                        print(f"   💾 STEP 7: Saving to Supabase...")
                        saved = self.save_to_supabase(
                            passage_data, all_questions, grade, url
                        )
                        
                        if saved:
                            print("   ✅ Successfully saved to database")
                            self.statistics['passages_saved'] += 1
                            self.passage_duplicate_detector.add_passage(
                                passage_data['text'], passage_data['theme']
                            )
                            passage_failures = 0  # Reset failure counter
                        else:
                            print("   ❌ Failed to save to database")
                            passage_failures += 1
                    
                    if not questions_generated:
                        print("   ❌ Failed to generate questions after all attempts")
                        self.statistics['passages_failed'] += 1
                        passage_failures += 1
        
        # Print final statistics
        self.print_statistics()
    
    def load_input_sources(self, input_source: str) -> List[str]:
        """Load URLs from various input sources"""
        urls = []
        
        if input_source.startswith('http'):
            urls = [input_source]
        elif input_source.endswith('.csv'):
            with open(input_source, 'r') as f:
                reader = csv.reader(f)
                urls = [row[0] for row in reader if row and row[0].startswith('http')]
        elif input_source.endswith('.txt'):
            with open(input_source, 'r') as f:
                urls = [line.strip() for line in f if line.strip().startswith('http')]
        else:
            print(f"❌ Unsupported input format: {input_source}")
        
        return urls
    
    def fetch_url_content(self, url: str) -> Optional[str]:
        """Fetch content from URL"""
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"❌ Error fetching URL: {e}")
            return None
    
    def extract_passage_with_gemini(self, content: str, grade: int, 
                                   min_words: int, max_words: int, 
                                   passage_num: int, url: str) -> Optional[Dict]:
        """Extract appropriate passage using Gemini - following isee_synonym.py pattern"""
        
        prompt = f"""You are an expert educational content curator for grade {grade} students.

TASK: Extract a reading comprehension passage from the provided text.

REQUIREMENTS:
1. The passage MUST be between {min_words}-{max_words} words (count every word)
2. Must be appropriate for grade {grade} reading level
3. Must be a complete, coherent excerpt (not fragments)
4. Must be educational and engaging
5. Should be different from previous passages (this is passage #{passage_num + 1} from this source)
6. Avoid passages that are too similar to what might have been extracted before

SOURCE URL: {url}

OUTPUT FORMAT (JSON):
{{
    "text": "The exact extracted passage text here",
    "word_count": <exact integer count>,
    "theme": "Main topic/theme in 2-3 words",
    "difficulty_score": <1-10 scale for grade {grade}>,
    "start_position": <character position in source>
}}

IMPORTANT: 
- Count words accurately (split by spaces and count)
- Ensure the passage is self-contained and makes sense on its own
- Pick interesting, educational content suitable for standardized tests

Extract a passage from this content:

{content[:10000]}...
"""
        
        try:
            self.statistics['gemini_calls'] += 1
            # Use the same pattern as isee_synonym.py
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Parse response exactly like isee_synonym.py
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
            
            passage_data = json.loads(response_text)
            
            # Validate word count
            actual_count = len(passage_data['text'].split())
            if actual_count < min_words or actual_count > max_words:
                print(f"   ⚠️ Word count mismatch: {actual_count} (required: {min_words}-{max_words})")
                return None
            
            passage_data['actual_word_count'] = actual_count
            return passage_data
            
        except Exception as e:
            print(f"   ❌ Gemini extraction error: {e}")
            return None
    
    def generate_all_questions_gemini(self, passage: str, grade: int) -> Optional[List[Dict]]:
        """Generate all comprehension questions using Gemini - following isee_synonym.py pattern"""
        
        prompt = f"""You are an expert test question creator for grade {grade} reading comprehension.

PASSAGE:
{passage}

TASK: Generate exactly 4 high-quality comprehension questions:
1. Main idea/theme question
2. Inference/reasoning question  
3. Vocabulary in context question
4. "None of the above" style question

REQUIREMENTS:
- ALL questions must have exactly 5 options (A, B, C, D, E)
- For the first 3 questions, E should be a plausible incorrect option
- For the 4th question, E must be "None of the above" and must be the CORRECT answer
- Exactly ONE correct answer per question
- Include detailed explanations for why each option is correct/incorrect
- Questions should be grade {grade} appropriate
- Test genuine comprehension, not just recall
- For the "None of the above" question: ask about something NOT stated or implied in the passage

OUTPUT FORMAT (JSON):
{{
    "questions": [
        {{
            "question_type": "main_idea",
            "question": "Question text here?",
            "options": {{
                "A": "Option A text",
                "B": "Option B text", 
                "C": "Option C text",
                "D": "Option D text",
                "E": "Option E text"
            }},
            "correct": "B",
            "explanation": "B is correct because... A is incorrect because... C is incorrect... D is incorrect... E is incorrect..."
        }},
        {{
            "question_type": "inference",
            "question": "Question text here?",
            "options": {{
                "A": "Option A text",
                "B": "Option B text", 
                "C": "Option C text",
                "D": "Option D text",
                "E": "Option E text"
            }},
            "correct": "C",
            "explanation": "C is correct because... A is incorrect because... B is incorrect... D is incorrect... E is incorrect..."
        }},
        {{
            "question_type": "vocabulary",
            "question": "Question about word meaning in context?",
            "options": {{
                "A": "Option A text",
                "B": "Option B text", 
                "C": "Option C text",
                "D": "Option D text",
                "E": "Option E text"
            }},
            "correct": "A",
            "explanation": "A is correct because... B is incorrect because... C is incorrect... D is incorrect... E is incorrect..."
        }},
        {{
            "question_type": "none_of_above",
            "question": "Question that tests what's NOT in the passage?",
            "options": {{
                "A": "Plausible but not supported by passage",
                "B": "Sounds reasonable but not in text",
                "C": "Could be true but not mentioned", 
                "D": "Logical but not stated",
                "E": "None of the above"
            }},
            "correct": "E",
            "explanation": "E is correct because the passage does not provide information about [specific thing]. Option A seems plausible but... Option B might appear true but... Option C... Option D..."
        }}
    ]
}}

Generate exactly 4 comprehension questions:"""
        
        try:
            self.statistics['gemini_calls'] += 1
            # Use the same pattern as isee_synonym.py
            response = model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Parse response exactly like isee_synonym.py
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
            
            content = json.loads(response_text)
            
            if 'questions' in content and len(content['questions']) == 4:
                return content['questions']
            else:
                print("      ⚠️ Invalid question format from Gemini")
                return None
                
        except Exception as e:
            print(f"      ❌ Gemini generation error: {e}")
            return None
    
    def validate_all_answers(self, questions: List[Dict]) -> bool:
        """Validate all answers exist in options and are properly formatted"""
        
        for i, q in enumerate(questions):
            # Check required fields
            if not all(key in q for key in ['question', 'options', 'correct', 'explanation']):
                print(f"      ❌ Question {i+1} missing required fields")
                return False
            
            # Check correct answer exists in options
            if q['correct'] not in q['options']:
                print(f"      ❌ Question {i+1} correct answer '{q['correct']}' not in options")
                return False
            
            # Check all expected options exist - ALL questions need 5 options
            expected = ['A', 'B', 'C', 'D', 'E']
            
            if not all(opt in q['options'] for opt in expected):
                print(f"      ❌ Question {i+1} missing expected options")
                return False
            
            # Check explanation mentions all options
            explanation_lower = q['explanation'].lower()
            for opt in expected:
                if opt.lower() not in explanation_lower:
                    print(f"      ⚠️ Question {i+1} explanation doesn't mention option {opt}")
        
        return True
    
    def save_to_supabase(self, passage_data: Dict, questions: List[Dict], 
                        grade: int, source_url: str) -> bool:
        """Save passage and questions to Supabase"""
        
        try:
            # Generate hash for duplicate detection
            content_hash = hashlib.sha256(
                f"{passage_data['text']}|{passage_data['theme']}".encode()
            ).hexdigest()
            
            # Check if already exists
            existing = supabase.table('question_cache')\
                .select('id')\
                .eq('question_hash', content_hash)\
                .execute()
            
            if existing.data:
                print("      ⚠️ Passage already exists in database")
                return False
            
            # Prepare question batch data with required fields
            question_batch = {
                "context": passage_data['text'],  # Required by database constraint
                "passage": passage_data['text'],
                "passage_theme": passage_data['theme'],
                "passage_word_count": passage_data['actual_word_count'],
                "questions": questions,
                "source_url": source_url,
                "question_count": len(questions),
                "grammar_concept": "reading_comprehension",  # Required by database
                "question_type": "comprehension_batch",  # Required by database
                "question": questions[0]['question'] if questions else "",  # Required by constraint
                "options": questions[0]['options'] if questions else {},
                "correct": questions[0]['correct'] if questions else "",
                "explanation": questions[0]['explanation'] if questions else ""
            }
            
            # Calculate difficulty based on grade
            difficulty_map = {5: 3, 6: 4, 7: 5, 8: 6, 9: 7}
            difficulty = difficulty_map.get(grade, 5)
            
            # Insert into database
            insert_data = {
                "topic": "english_comprehension",
                "difficulty": difficulty,
                "grade": grade,
                "question": question_batch,
                "ai_model": "gemini-2.5-flash",
                "question_hash": content_hash
            }
            
            result = supabase.table('question_cache').insert(insert_data).execute()
            return True
            
        except Exception as e:
            print(f"      ❌ Database save error: {e}")
            return False
    
    def print_statistics(self):
        """Print comprehensive statistics"""
        print(f"\n{'='*60}")
        print("📊 GENERATION STATISTICS:")
        print(f"   Total URLs processed: {self.statistics['total_urls_processed']}")
        print(f"   Passages extracted: {self.statistics['passages_extracted']}")
        print(f"   Passages rejected (duplicates): {self.statistics['passages_rejected_duplicates']}")
        print(f"   Questions generated: {self.statistics['questions_generated']}")
        print(f"   Passages failed: {self.statistics['passages_failed']}")
        print(f"   Passages saved: {self.statistics['passages_saved']}")
        print(f"   Gemini API calls: {self.statistics['gemini_calls']}")
        
        # Calculate success rate
        if self.statistics['passages_extracted'] > 0:
            success_rate = (self.statistics['passages_saved'] / self.statistics['passages_extracted']) * 100
            print(f"   Success rate: {success_rate:.1f}%")


class PassageDuplicateDetector:
    """Detect duplicate passages using fuzzy matching and theme detection"""
    
    def __init__(self):
        self.existing_passages: List[Dict] = []
        self.existing_themes: Set[str] = set()
        self.loaded = False
    
    def load_existing_passages(self):
        """Load existing passages from database"""
        if self.loaded:
            return
        
        try:
            print("   Loading existing passages for duplicate detection...")
            result = supabase.table('question_cache')\
                .select('question')\
                .eq('topic', 'english_comprehension')\
                .execute()
            
            for record in result.data:
                if record['question'] and 'passage' in record['question']:
                    passage_text = record['question']['passage']
                    theme = record['question'].get('passage_theme', '')
                    
                    self.existing_passages.append({
                        'text': passage_text.lower(),
                        'theme': theme.lower()
                    })
                    if theme:
                        self.existing_themes.add(theme.lower())
            
            self.loaded = True
            print(f"   ✅ Loaded {len(self.existing_passages)} existing passages")
            
        except Exception as e:
            print(f"   ⚠️ Failed to load existing passages: {e}")
            self.loaded = True
    
    def is_duplicate(self, passage: str, theme: str) -> Tuple[bool, str]:
        """Check if passage is duplicate using fuzzy matching"""
        
        passage_lower = passage.lower()
        theme_lower = theme.lower()
        
        # Check exact theme match first
        if theme_lower in self.existing_themes:
            return True, f"Theme '{theme}' already exists"
        
        # Check fuzzy similarity with existing passages
        for existing in self.existing_passages:
            similarity = SequenceMatcher(None, passage_lower, existing['text']).ratio()
            
            if similarity > FUZZY_SIMILARITY_THRESHOLD:
                return True, f"Too similar to existing passage ({similarity*100:.0f}% match)"
        
        return False, "Unique passage"
    
    def add_passage(self, passage: str, theme: str):
        """Add passage to tracking"""
        self.existing_passages.append({
            'text': passage.lower(),
            'theme': theme.lower()
        })
        if theme:
            self.existing_themes.add(theme.lower())


def main():
    """Main execution function"""
    generator = ReadingComprehensionGenerator()
    
    # Use urls.txt file if it exists, otherwise use single test URL
    if os.path.exists('urls.txt'):
        print("🚀 Reading Comprehension Generator")
        print("📚 Using Gemini 2.5 Flash (Following isee_synonym.py pattern)")
        print("📄 Loading URLs from urls.txt")
        generator.main_workflow('urls.txt')
    else:
        # Fallback to single URL
        test_url = "https://www.gutenberg.org/cache/epub/9701/pg9701.txt"
        print("🚀 Reading Comprehension Generator")
        print("📚 Using Gemini 2.5 Flash (Following isee_synonym.py pattern)")
        print(f"🔗 Processing: {test_url}")
        generator.main_workflow(test_url)
    
    print("\n✅ Generation complete!")


if __name__ == "__main__":
    main()
