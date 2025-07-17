#!/usr/bin/env python3
"""
Educational Content Generator for SAT/ISEE Prep
Generates vocabulary, grammar, and comprehension questions based on grade, mood, and difficulty
Automatically imports to Supabase database
"""

import os
import json
import random
import uuid
from typing import List, Dict, Any
from datetime import datetime
from supabase import create_client, Client
from dataclasses import dataclass
import nltk
from nltk.corpus import wordnet
import requests
import ssl
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Fix SSL certificate issue for NLTK downloads on Mac
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

# Download required NLTK data (run once)
try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    try:
        nltk.download('wordnet')
    except Exception as e:
        print(f"Warning: Could not download NLTK wordnet data: {e}")
        print("Synonyms/antonyms generation may be limited")

@dataclass
class ContentConfig:
    grade: int  # 5-11
    mood: str   # adventurous, analytical, challenging, etc.
    difficulty: int  # 1-9
    test_type: str  # pre-sat, sat, isee

class EducationalContentGenerator:
    def __init__(self):
        # Try different environment variable names for Supabase
        self.supabase_url = (
            os.getenv('NEXT_PUBLIC_SUPABASE_URL') or 
            os.getenv('SUPABASE_URL') or 
            os.getenv('VITE_SUPABASE_URL')
        )
        
        self.supabase_key = (
            os.getenv('SUPABASE_SERVICE_ROLE_KEY') or 
            os.getenv('SUPABASE_ANON_KEY') or 
            os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY') or
            os.getenv('VITE_SUPABASE_ANON_KEY')
        )
        
        # Debug: Print what we found
        print(f"Supabase URL found: {self.supabase_url is not None}")
        print(f"Supabase Key found: {self.supabase_key is not None}")
        
        if not self.supabase_url or not self.supabase_key:
            print("Available environment variables:")
            for key in os.environ:
                if 'SUPABASE' in key.upper():
                    print(f"  {key}")
            raise ValueError("Please set Supabase environment variables. Check your .env file format.")
        
        try:
            self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
            print("✅ Successfully connected to Supabase!")
        except Exception as e:
            print(f"❌ Failed to connect to Supabase: {e}")
            raise
        
        # Word lists by grade level
        self.grade_vocabulary = {
            5: ["abundant", "accurate", "achieve", "acquire", "adequate", "ancient", "apparent", "approach", "appropriate", "approximate"],
            6: ["analyze", "anticipate", "apparent", "appropriate", "approximate", "assess", "assume", "benefit", "capacity", "challenge"],
            7: ["abstract", "accumulate", "adequate", "advocate", "alternative", "analyze", "anticipate", "apparent", "arbitrary", "assess"],
            8: ["abstract", "academic", "accumulate", "adequate", "advocate", "alternative", "ambiguous", "analyze", "anticipate", "arbitrary"],
            9: ["abstract", "academic", "accessible", "accommodate", "accompany", "accumulate", "accurate", "achieve", "acknowledge", "acquire"],
            10: ["aberrant", "abscond", "abstemious", "acerbic", "acrimonious", "acumen", "admonish", "aesthetic", "affable", "aggrandize"],
            11: ["abate", "aberrant", "abeyance", "abscond", "abstemious", "acerbic", "acrimonious", "acumen", "admonish", "aesthetic"]
        }
        
        # Mood-based content themes
        self.mood_themes = {
            "adventurous": {"context": "exploration, travel, discovery", "tone": "exciting, dynamic"},
            "analytical": {"context": "research, analysis, problem-solving", "tone": "logical, methodical"},
            "challenging": {"context": "obstacles, competition, achievement", "tone": "demanding, rigorous"},
            "competitive": {"context": "sports, contests, rivalry", "tone": "competitive, energetic"},
            "chill": {"context": "modern trends, technology, innovation", "tone": "contemporary, stylish"},
            "creative": {"context": "art, imagination, innovation", "tone": "inspiring, original"},
            "curious": {"context": "investigation, wonder, learning", "tone": "inquisitive, engaging"},
            "encouraging": {"context": "support, motivation, growth", "tone": "positive, uplifting"},
            "playful": {"context": "games, fun, entertainment", "tone": "lighthearted, engaging"},
            "practical": {"context": "real-world applications, utility", "tone": "straightforward, useful"},
            "relaxed": {"context": "calm settings, leisure, peace", "tone": "soothing, gentle"},
            "social": {"context": "community, friendship, collaboration", "tone": "friendly, interactive"}
        }

    def get_synonyms_antonyms(self, word: str) -> Dict[str, List[str]]:
        """Get synonyms and antonyms using WordNet"""
        synonyms = set()
        antonyms = set()
        
        for syn in wordnet.synsets(word):
            for lemma in syn.lemmas():
                synonyms.add(lemma.name().replace('_', ' '))
                if lemma.antonyms():
                    for ant in lemma.antonyms():
                        antonyms.add(ant.name().replace('_', ' '))
        
        # Remove the original word
        synonyms.discard(word)
        
        return {
            "synonyms": list(synonyms)[:20],  # Limit to 20
            "antonyms": list(antonyms)[:20]   # Limit to 20
        }

    def generate_vocabulary_questions(self, config: ContentConfig, count: int = 10) -> List[Dict[str, Any]]:
        """Generate vocabulary questions"""
        words = self.grade_vocabulary.get(config.grade, self.grade_vocabulary[9])
        theme = self.mood_themes[config.mood]
        questions = []
        
        for i in range(count):
            word = random.choice(words)
            synonyms_antonyms = self.get_synonyms_antonyms(word)
            
            # Create context sentence based on mood
            context_templates = {
                "adventurous": [
                    f"During the {word} journey through the Amazon rainforest, the explorers...",
                    f"The {word} expedition to the mountain peak required...",
                    f"With {word} spirit, the team embarked on...",
                    f"The {word} quest led them through unknown territories where..."
                ],
                "analytical": [
                    f"The researcher's {word} approach to the data revealed...",
                    f"Using {word} methods, scientists discovered that...",
                    f"The {word} examination of the evidence showed...",
                    f"Through {word} observation, the student noticed that..."
                ],
                "chill": [
                    f"In the peaceful {word} of the evening, Sarah decided to...",
                    f"The {word} music drifted through the coffee shop as...",
                    f"Under the {word} shade of the old oak tree, children were...",
                    f"With a {word} smile, the teacher explained that..."
                ],
                "relaxed": [
                    f"In the {word} atmosphere of the garden, visitors could...",
                    f"The {word} pace of the afternoon allowed everyone to...",
                    f"During the {word} weekend, families enjoyed...",
                    f"The {word} environment helped students focus on..."
                ],
                "challenging": [
                    f"The {word} obstacle required tremendous effort to overcome...",
                    f"Facing the {word} problem, the team had to...",
                    f"The {word} assignment pushed students to...",
                    f"Despite the {word} conditions, they managed to..."
                ],
                "competitive": [
                    f"In the {word} tournament, players demonstrated...",
                    f"The {word} spirit drove the athletes to...",
                    f"During the {word} debate, students argued that...",
                    f"The {word} environment encouraged everyone to..."
                ],
                "curious": [
                    f"With {word} minds, the children wondered why...",
                    f"The {word} scientist asked what would happen if...",
                    f"Students raised {word} questions about...",
                    f"Her {word} nature led her to investigate..."
                ],
                "social": [
                    f"At the {word} gathering, friends discussed...",
                    f"The {word} event brought together people who...",
                    f"During the {word} meeting, participants shared...",
                    f"The {word} atmosphere encouraged everyone to..."
                ],
                "creative": [
                    f"The artist's {word} vision transformed the canvas into...",
                    f"With {word} thinking, the designer solved...",
                    f"The {word} project allowed students to...",
                    f"Using {word} approaches, the team developed..."
                ],
                "practical": [
                    f"The {word} solution addressed the problem by...",
                    f"With {word} steps, the mechanic repaired...",
                    f"The {word} approach focused on what actually...",
                    f"Using {word} methods, workers completed..."
                ]
            }
            
            context_list = context_templates.get(config.mood, [f"The {word} situation required careful consideration..."])
            context = random.choice(context_list)
            
            question = {
                "id": str(uuid.uuid4()),
                "type": "vocabulary",
                "grade": config.grade,
                "mood": config.mood,
                "difficulty": config.difficulty,
                "test_type": config.test_type,
                "word": word,
                "synonyms": synonyms_antonyms["synonyms"],
                "antonyms": synonyms_antonyms["antonyms"],
                "context_sentence": context,
                "question_text": f"What is the meaning of '{word}' in the following context?",
                "created_at": datetime.now().isoformat()
            }
            questions.append(question)
        
        return questions

    def generate_sentence_correction(self, config: ContentConfig, count: int = 10) -> List[Dict[str, Any]]:
        """Generate sentence correction questions"""
        questions = []
        theme = self.mood_themes[config.mood]
        
        # Common grammar errors by difficulty
        error_patterns = {
            1: ["subject-verb disagreement", "wrong verb tense"],
            3: ["misplaced modifiers", "parallel structure"],
            5: ["pronoun reference", "comparative forms"],
            7: ["subjunctive mood", "complex verb forms"],
            9: ["advanced syntax", "idiomatic expressions"]
        }
        
        patterns = error_patterns.get(config.difficulty, error_patterns[5])
        
        for i in range(count):
            pattern = random.choice(patterns)
            
            # Initialize variables
            incorrect = ""
            correct = ""
            
            # Generate sentences based on mood and error pattern
            if config.mood == "relaxed":
                if pattern == "subject-verb disagreement":
                    incorrect = "The group of friends were enjoying the peaceful sunset."
                    correct = "The group of friends was enjoying the peaceful sunset."
                elif pattern == "wrong verb tense":
                    incorrect = "Last weekend, we will relax by the lake."
                    correct = "Last weekend, we relaxed by the lake."
                elif pattern == "parallel structure":
                    incorrect = "She enjoyed reading, walking, and to meditate in the garden."
                    correct = "She enjoyed reading, walking, and meditating in the garden."
                elif pattern == "pronoun reference":
                    incorrect = "When Sarah met Lisa, she was very calm."
                    correct = "When Sarah met Lisa, Sarah was very calm."
                else:
                    incorrect = "The peaceful environment were perfect for relaxation."
                    correct = "The peaceful environment was perfect for relaxation."
                    
            elif config.mood == "adventurous":
                if pattern == "subject-verb disagreement":
                    incorrect = "The team of explorers were crossing the dangerous rapids."
                    correct = "The team of explorers was crossing the dangerous rapids."
                elif pattern == "wrong verb tense":
                    incorrect = "Yesterday, the adventurers will climb the mountain."
                    correct = "Yesterday, the adventurers climbed the mountain."
                elif pattern == "parallel structure":
                    incorrect = "The explorer enjoyed hiking, climbing, and to discover new places."
                    correct = "The explorer enjoyed hiking, climbing, and discovering new places."
                elif pattern == "pronoun reference":
                    incorrect = "When the guide met the tourist, he was excited about the journey."
                    correct = "When the guide met the tourist, the guide was excited about the journey."
                else:
                    incorrect = "The dangerous expedition were thrilling for everyone."
                    correct = "The dangerous expedition was thrilling for everyone."
                    
            elif config.mood == "analytical":
                if pattern == "subject-verb disagreement":
                    incorrect = "The collection of data were analyzed carefully."
                    correct = "The collection of data was analyzed carefully."
                elif pattern == "wrong verb tense":
                    incorrect = "Last month, the researchers will publish their findings."
                    correct = "Last month, the researchers published their findings."
                elif pattern == "parallel structure":
                    incorrect = "The study involved collecting data, analyzing results, and to draw conclusions."
                    correct = "The study involved collecting data, analyzing results, and drawing conclusions."
                elif pattern == "pronoun reference":
                    incorrect = "When the scientist met the professor, she presented the research."
                    correct = "When the scientist met the professor, the scientist presented the research."
                else:
                    incorrect = "The comprehensive analysis were completed successfully."
                    correct = "The comprehensive analysis was completed successfully."
                    
            else:
                # Default cases for other moods
                if pattern == "subject-verb disagreement":
                    incorrect = "The group of students were studying together."
                    correct = "The group of students was studying together."
                elif pattern == "wrong verb tense":
                    incorrect = "Yesterday, they will complete their assignment."
                    correct = "Yesterday, they completed their assignment."
                elif pattern == "parallel structure":
                    incorrect = "The teacher enjoyed teaching, helping students, and to grade papers."
                    correct = "The teacher enjoyed teaching, helping students, and grading papers."
                elif pattern == "pronoun reference":
                    incorrect = "When the student met the teacher, she asked questions."
                    correct = "When the student met the teacher, the student asked questions."
                else:
                    incorrect = "The important lesson were learned by everyone."
                    correct = "The important lesson was learned by everyone."
            
            question = {
                "id": str(uuid.uuid4()),
                "type": "sentence_correction",
                "grade": config.grade,
                "mood": config.mood,
                "difficulty": config.difficulty,
                "test_type": config.test_type,
                "incorrect_sentence": incorrect,
                "correct_sentence": correct,
                "error_type": pattern,
                "explanation": f"This sentence contains a {pattern} error.",
                "created_at": datetime.now().isoformat()
            }
            questions.append(question)
        
        return questions

    def generate_fill_in_blanks(self, config: ContentConfig, count: int = 50) -> List[Dict[str, Any]]:
        """Generate fill-in-the-blank questions"""
        questions = []
        words = self.grade_vocabulary.get(config.grade, self.grade_vocabulary[8])
        
        for i in range(count):
            word = random.choice(words)
            
            # Initialize variables
            sentence = ""
            options = []
            correct_answer = ""
            
            # Create sentences based on mood
            if config.mood == "relaxed":
                sentence = f"The _____ afternoon was perfect for reading in the garden."
                options = ["peaceful", "chaotic", "stressful", "noisy"]
                correct_answer = "peaceful"
            elif config.mood == "adventurous":
                sentence = f"The _____ explorer discovered a hidden cave filled with ancient treasures."
                options = ["bold", "timid", "lazy", "confused"]
                correct_answer = "bold"
            elif config.mood == "analytical":
                sentence = f"The scientist's _____ research methodology led to groundbreaking discoveries."
                options = ["rigorous", "careless", "hasty", "random"]
                correct_answer = "rigorous"
            elif config.mood == "challenging":
                sentence = f"The _____ obstacle required tremendous effort to overcome."
                options = ["formidable", "simple", "easy", "trivial"]
                correct_answer = "formidable"
            elif config.mood == "creative":
                sentence = f"The artist's _____ imagination produced stunning works of art."
                options = ["vivid", "dull", "limited", "blocked"]
                correct_answer = "vivid"
            elif config.mood == "curious":
                sentence = f"The _____ student asked many thought-provoking questions."
                options = ["inquisitive", "indifferent", "bored", "sleepy"]
                correct_answer = "inquisitive"
            elif config.mood == "social":
                sentence = f"The _____ group worked together on the community project."
                options = ["collaborative", "isolated", "selfish", "uncooperative"]
                correct_answer = "collaborative"
            else:
                # Default case for other moods
                sentence = f"The _____ student completed the assignment successfully."
                options = ["diligent", "lazy", "careless", "distracted"]
                correct_answer = "diligent"
            
            question = {
                "id": str(uuid.uuid4()),
                "type": "fill_in_blank",
                "grade": config.grade,
                "mood": config.mood,
                "difficulty": config.difficulty,
                "test_type": config.test_type,
                "sentence": sentence,
                "options": options,
                "correct_answer": correct_answer,
                "explanation": f"'{correct_answer}' best fits the context and mood of the sentence.",
                "created_at": datetime.now().isoformat()
            }
            questions.append(question)
        
        return questions

    def generate_incorrect_sentence_identification(self, config: ContentConfig, count: int = 10) -> List[Dict[str, Any]]:
        """Generate questions to identify incorrect sentences"""
        questions = []
        
        for i in range(count):
            # Create sets of sentences with one incorrect
            if config.mood == "adventurous":
                sentences = [
                    "The brave explorer navigated through the treacherous jungle.",  # Correct
                    "Despite the danger, she continued her quest for the lost city.",  # Correct
                    "The ancient map was leading them to their destination.",  # Incorrect - progressive tense
                    "Finally, they reached the mysterious temple."  # Correct
                ]
                incorrect_index = 2
                error_explanation = "Should be 'led' (past tense) instead of 'was leading'"
                question_text = "Identify the incorrect sentence from the adventure story"
            
            elif config.mood == "relaxed":
                sentences = [
                    "The peaceful garden provided a perfect retreat.",  # Correct
                    "Visitors often came here to escape the city's noise.",  # Correct
                    "The flowers was blooming beautifully in spring.",  # Incorrect - subject-verb disagreement
                    "Everyone felt refreshed after spending time there."  # Correct
                ]
                incorrect_index = 2
                error_explanation = "Should be 'were' not 'was' (flowers is plural)"
                question_text = "Identify the incorrect sentence about the garden"
            
            elif config.mood == "social":
                sentences = [
                    "The community center hosted many social events.",  # Correct
                    "People gathered to celebrate the neighborhood festival.",  # Correct
                    "The volunteers was organizing activities for everyone.",  # Incorrect - subject-verb disagreement
                    "Everyone enjoyed the friendly atmosphere."  # Correct
                ]
                incorrect_index = 2
                error_explanation = "Should be 'were' not 'was' (volunteers is plural)"
                question_text = "Identify the incorrect sentence about the community event"
            
            else:
                # Default for other moods
                sentences = [
                    "The students studied diligently for their exams.",  # Correct
                    "Each of them were prepared for the test.",  # Incorrect - subject-verb disagreement
                    "The teacher provided helpful feedback.",  # Correct
                    "Everyone felt confident about their performance."  # Correct
                ]
                incorrect_index = 1
                error_explanation = "Should be 'was' not 'were' (each is singular)"
                question_text = "Identify the incorrect sentence"
            
            question = {
                "id": str(uuid.uuid4()),
                "type": "identify_incorrect",
                "grade": config.grade,
                "mood": config.mood,
                "difficulty": config.difficulty,
                "test_type": config.test_type,
                "question_text": question_text,
                "sentences": sentences,
                "incorrect_sentence_index": incorrect_index,
                "error_explanation": error_explanation,
                "created_at": datetime.now().isoformat()
            }
            questions.append(question)
        
        return questions

    def generate_grammar_questions(self, config: ContentConfig, count: int = 10) -> List[Dict[str, Any]]:
        """Generate grammar-focused questions"""
        questions = []
        
        grammar_topics = {
            5: ["parts of speech", "simple sentences", "basic punctuation"],
            7: ["complex sentences", "clauses", "advanced punctuation"],
            9: ["parallel structure", "subjunctive mood", "advanced syntax"],
            11: ["sophisticated syntax", "rhetorical devices", "advanced grammar"]
        }
        
        topics = grammar_topics.get(config.grade, grammar_topics[9])
        
        for i in range(count):
            topic = random.choice(topics)
            
            # Initialize variables
            question_text = ""
            sentence = ""
            options = []
            correct_answer = ""
            
            if topic == "parts of speech":
                question_text = "Identify the part of speech of the underlined word:"
                if config.mood == "adventurous":
                    sentence = "The explorer *quickly* crossed the river."
                    correct_answer = "adverb"
                    options = ["adverb", "adjective", "noun", "verb"]
                elif config.mood == "relaxed":
                    sentence = "The *peaceful* garden was beautiful."
                    correct_answer = "adjective"
                    options = ["adjective", "adverb", "noun", "verb"]
                else:
                    sentence = "The student *carefully* read the book."
                    correct_answer = "adverb"
                    options = ["adverb", "adjective", "noun", "verb"]
            
            elif topic == "parallel structure":
                question_text = "Which sentence demonstrates correct parallel structure?"
                options = [
                    "She likes hiking, swimming, and to read books.",  # Incorrect
                    "She likes hiking, swimming, and reading books.",  # Correct
                    "She likes to hike, swimming, and reading books.",  # Incorrect
                    "She likes to hike, to swim, and reading books."  # Incorrect
                ]
                correct_answer = options[1]
                sentence = "Select the correct sentence from the options below."
            
            elif topic == "simple sentences":
                question_text = "Which is a complete simple sentence?"
                if config.mood == "relaxed":
                    options = [
                        "Walking in the peaceful garden.",  # Incomplete
                        "The garden was peaceful and beautiful.",  # Correct
                        "Although the garden was peaceful.",  # Incomplete
                        "In the beautiful, peaceful garden."  # Incomplete
                    ]
                else:
                    options = [
                        "Running to the store quickly.",  # Incomplete
                        "The student completed the assignment.",  # Correct
                        "Because the assignment was difficult.",  # Incomplete
                        "During the long study session."  # Incomplete
                    ]
                correct_answer = options[1]
                sentence = "Select the complete sentence from the options below."
            
            elif topic == "basic punctuation":
                question_text = "Which sentence uses punctuation correctly?"
                options = [
                    "Hello John, how are you today.",  # Incorrect
                    "Hello, John how are you today?",  # Incorrect
                    "Hello, John, how are you today?",  # Correct
                    "Hello John how are you today?"  # Incorrect
                ]
                correct_answer = options[2]
                sentence = "Select the correctly punctuated sentence."
            
            else:
                # Default case for other topics
                question_text = f"Which sentence demonstrates proper {topic}?"
                options = [
                    "Option A - Incorrect example",
                    "Option B - Correct example",
                    "Option C - Incorrect example",
                    "Option D - Incorrect example"
                ]
                correct_answer = options[1]
                sentence = f"This question tests understanding of {topic}."
            
            question = {
                "id": str(uuid.uuid4()),
                "type": "grammar",
                "grade": config.grade,
                "mood": config.mood,
                "difficulty": config.difficulty,
                "test_type": config.test_type,
                "topic": topic,
                "question_text": question_text,
                "sentence": sentence,
                "options": options,
                "correct_answer": correct_answer,
                "explanation": f"This question tests understanding of {topic}.",
                "created_at": datetime.now().isoformat()
            }
            questions.append(question)
        
        return questions

    def format_for_database(self, questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format questions to match database schema: topic, difficulty, grade, question (jsonb), ai_model, mood, etc."""
        formatted_questions = []
        
        for q in questions:
            # Create the question JSONB object with all the question data
            question_data = {
                "id": q["id"],
                "type": q["type"],
                "test_type": q["test_type"],
                "created_at": q["created_at"]
            }
            
            # Add type-specific fields to question_data
            if q["type"] == "vocabulary":
                question_data.update({
                    "word": q["word"],
                    "synonyms": q.get("synonyms", []),
                    "antonyms": q.get("antonyms", []),
                    "context_sentence": q.get("context_sentence", ""),
                    "question_text": q.get("question_text", "")
                })
            elif q["type"] == "sentence_correction":
                question_data.update({
                    "incorrect_sentence": q.get("incorrect_sentence", ""),
                    "correct_sentence": q.get("correct_sentence", ""),
                    "error_type": q.get("error_type", ""),
                    "explanation": q.get("explanation", "")
                })
            elif q["type"] == "fill_in_blank":
                question_data.update({
                    "sentence": q.get("sentence", ""),
                    "options": q.get("options", []),
                    "correct_answer": q.get("correct_answer", ""),
                    "explanation": q.get("explanation", "")
                })
            elif q["type"] == "identify_incorrect":
                question_data.update({
                    "question_text": q.get("question_text", ""),
                    "sentences": q.get("sentences", []),
                    "incorrect_sentence_index": q.get("incorrect_sentence_index", 0),
                    "error_explanation": q.get("error_explanation", "")
                })
            elif q["type"] == "grammar":
                question_data.update({
                    "topic": q.get("topic", ""),
                    "question_text": q.get("question_text", ""),
                    "sentence": q.get("sentence", ""),
                    "options": q.get("options", []),
                    "correct_answer": q.get("correct_answer", ""),
                    "explanation": q.get("explanation", "")
                })
            elif q["type"] == "reading_comprehension":
                question_data.update({
                    "passage_title": q.get("passage_title", ""),
                    "passage_text": q.get("passage_text", ""),
                    "questions": q.get("questions", []),
                    "word_count": len(q.get("passage_text", "").split())
                })
            
            # Create a simple hash for the question content
            import hashlib
            if q['type'] == 'reading_comprehension':
                question_str = f"{q['type']}_{q.get('passage_title', '')}_{q.get('passage_text', '')[:100]}_{q['grade']}_{q['mood']}"
            else:
                question_str = f"{q['type']}_{q.get('word', '')}_{q.get('question_text', '')}_{q.get('sentence', '')}_{q['grade']}_{q['mood']}"
            question_hash = hashlib.md5(question_str.encode()).hexdigest()
            
            # Format for database schema - matching your exact table structure
            formatted_question = {
                "topic": "english_vocabulary",  # Required field
                "difficulty": q["difficulty"],  # Required field
                "grade": q["grade"],  # Required field
                "question": question_data,  # Required JSONB field
                "ai_model": "code",  # Required field - the AI model used
                "mood": q["mood"],  # Optional field but you have it in your schema
                "question_hash": question_hash,  # Optional field for deduplication
                "answer_explanation": q.get("explanation", "Generated by educational content system"),  # Optional
                "usage_count": 0,  # Default value
                "expires_at": None  # No expiration for generated content
            }
            
            formatted_questions.append(formatted_question)
        
        return formatted_questions

    def check_for_duplicates(self, questions: List[Dict[str, Any]], table_name: str = "question_cache") -> List[Dict[str, Any]]:
        """Check for existing questions and filter out duplicates"""
        try:
            print("Checking for existing content in database...")
            
            # Get all existing questions from database
            existing_result = self.supabase.table(table_name).select("topic, difficulty, grade, mood, question, question_hash").execute()
            existing_questions = existing_result.data
            
            # Create a set of unique identifiers for existing questions
            existing_identifiers = set()
            existing_hashes = set()
            
            for existing in existing_questions:
                question_data = existing.get('question', {})
                
                # Use question_hash if available
                if existing.get('question_hash'):
                    existing_hashes.add(existing['question_hash'])
                
                # Create unique identifier based on content and parameters as backup
                question_type = question_data.get('type', 'unknown')
                if question_type == 'vocabulary':
                    word = question_data.get('word', '')
                    identifier = f"{question_type}_{word}_{existing['grade']}_{existing.get('mood', '')}_{existing['difficulty']}"
                elif question_type == 'sentence_correction':
                    incorrect = question_data.get('incorrect_sentence', '')
                    identifier = f"{question_type}_{incorrect}_{existing['grade']}_{existing.get('mood', '')}"
                elif question_type == 'fill_in_blank':
                    sentence = question_data.get('sentence', '')
                    identifier = f"{question_type}_{sentence}_{existing['grade']}_{existing.get('mood', '')}"
                elif question_type == 'identify_incorrect':
                    q_text = question_data.get('question_text', 'identify_incorrect')
                    identifier = f"{question_type}_{q_text}_{existing['grade']}_{existing.get('mood', '')}"
                elif question_type == 'grammar':
                    q_text = question_data.get('question_text', '')
                    identifier = f"{question_type}_{q_text}_{existing['grade']}_{existing.get('mood', '')}"
                elif question_type == 'reading_comprehension':
                    passage_title = question_data.get('passage_title', '')
                    identifier = f"{question_type}_{passage_title}_{existing['grade']}_{existing.get('mood', '')}"
                else:
                    q_text = question_data.get('question_text', 'unknown')
                    identifier = f"{question_type}_{q_text}_{existing['grade']}_{existing.get('mood', '')}"
                
                existing_identifiers.add(identifier)
            
            # Filter out duplicates from new questions (before formatting)
            unique_questions = []
            skipped_count = 0
            
            for question in questions:
                # Create hash for the new question
                import hashlib
                if question['type'] == 'reading_comprehension':
                    question_str = f"{question['type']}_{question.get('passage_title', '')}_{question.get('passage_text', '')[:100]}_{question['grade']}_{question['mood']}"
                else:
                    question_str = f"{question['type']}_{question.get('word', '')}_{question.get('question_text', '')}_{question.get('sentence', '')}_{question['grade']}_{question['mood']}"
                question_hash = hashlib.md5(question_str.encode()).hexdigest()
                
                # Check if hash already exists
                if question_hash in existing_hashes:
                    skipped_count += 1
                    continue
                
                # Create identifier for new question as backup check
                if question['type'] == 'vocabulary':
                    identifier = f"{question['type']}_{question['word']}_{question['grade']}_{question['mood']}_{question['difficulty']}"
                elif question['type'] == 'sentence_correction':
                    identifier = f"{question['type']}_{question['incorrect_sentence']}_{question['grade']}_{question['mood']}"
                elif question['type'] == 'fill_in_blank':
                    identifier = f"{question['type']}_{question['sentence']}_{question['grade']}_{question['mood']}"
                elif question['type'] == 'identify_incorrect':
                    identifier = f"{question['type']}_{question.get('question_text', 'identify_incorrect')}_{question['grade']}_{question['mood']}"
                elif question['type'] == 'grammar':
                    identifier = f"{question['type']}_{question['question_text']}_{question['grade']}_{question['mood']}"
                elif question['type'] == 'reading_comprehension':
                    identifier = f"{question['type']}_{question.get('passage_title', '')}_{question['grade']}_{question['mood']}"
                else:
                    identifier = f"{question['type']}_{question.get('question_text', 'unknown')}_{question['grade']}_{question['mood']}"
                
                if identifier not in existing_identifiers:
                    unique_questions.append(question)
                else:
                    skipped_count += 1
            
            print(f"Found {len(existing_questions)} existing questions in database")
            print(f"Skipped {skipped_count} duplicate questions")
            print(f"Will upload {len(unique_questions)} new unique questions")
            
            return unique_questions
            
        except Exception as e:
            print(f"Error checking for duplicates: {e}")
            print("Proceeding with all questions (duplicate check failed)")
            return questions

    def upload_to_supabase(self, questions: List[Dict[str, Any]], table_name: str = "question_cache"):
        """Upload generated content to Supabase, skipping duplicates"""
        try:
            # Check for duplicates first
            unique_questions = self.check_for_duplicates(questions, table_name)
            
            if not unique_questions:
                print("No new questions to upload - all questions already exist in database!")
                return True
            
            # Format questions for database schema
            formatted_questions = self.format_for_database(unique_questions)
            
            # Insert data in batches to avoid size limits
            batch_size = 10000  # Smaller batches for JSONB data
            uploaded_count = 0
            
            for i in range(0, len(formatted_questions), batch_size):
                batch = formatted_questions[i:i + batch_size]
                try:
                    result = self.supabase.table(table_name).insert(batch).execute()
                    uploaded_count += len(batch)
                    print(f"Uploaded batch {i//batch_size + 1}: {len(batch)} questions")
                except Exception as batch_error:
                    print(f"Error uploading batch {i//batch_size + 1}: {batch_error}")
                    # Try uploading individual questions in this batch
                    for question in batch:
                        try:
                            self.supabase.table(table_name).insert([question]).execute()
                            uploaded_count += 1
                        except Exception as individual_error:
                            print(f"Failed to upload individual question: {individual_error}")
            
            print(f"Successfully uploaded {uploaded_count} new questions to Supabase!")
            return True
            
        except Exception as e:
            print(f"Error uploading to Supabase: {e}")
            return False

    def generate_reading_comprehension(self, config: ContentConfig, count: int = 10) -> List[Dict[str, Any]]:
        """Generate reading comprehension passages with multiple choice questions"""
        questions = []
        theme = self.mood_themes[config.mood]
        
        for i in range(count):
            # Generate passage based on mood and grade level
            passage, passage_title = self.create_passage(config)
            
            # Generate 4-5 questions per passage
            passage_questions = self.create_comprehension_questions(passage, config)
            
            # Create the complete reading comprehension question
            question = {
                "id": str(uuid.uuid4()),
                "type": "reading_comprehension",
                "grade": config.grade,
                "mood": config.mood,
                "difficulty": config.difficulty,
                "test_type": config.test_type,
                "passage_title": passage_title,
                "passage_text": passage,
                "questions": passage_questions,
                "created_at": datetime.now().isoformat()
            }
            questions.append(question)
        
        return questions
    
    def create_passage(self, config: ContentConfig) -> tuple[str, str]:
        """Create a passage based on mood, grade, and difficulty (150-250 words)"""
        
        if config.mood == "adventurous":
            if config.grade <= 6:
                title = "The Young Explorer's Discovery"
                passage = """Maya had always dreamed of exploring mysterious places. When her family moved to a house near the old forest, she couldn't wait to investigate. Armed with her backpack, compass, and notebook, Maya ventured into the woods behind her new home.
                
                The forest was alive with sounds. Birds chirped melodiously overhead while squirrels scampered up tall oak trees. As Maya walked deeper into the forest, she noticed strange markings on some trees. They looked like symbols carved long ago by someone who had been there before her.
                
                Following the marked trees like a trail, Maya discovered a small clearing with an old stone structure. It wasn't very large, but it was clearly built by human hands many years ago. Moss covered most of the stones, and wildflowers grew around its base. Maya carefully sketched the structure in her notebook and took note of its location.
                
                When she returned home, Maya researched the area's history at the local library. She learned that the stone structure was built by early settlers as a landmark. Her discovery made her feel like a real explorer, and she couldn't wait to share her findings with her new classmates."""
            else:
                title = "The Arctic Research Expedition"
                passage = """Dr. Sarah Chen adjusted her protective goggles as the helicopter descended toward the remote Arctic research station. As the lead glaciologist on this expedition, she carried the responsibility of collecting crucial data about climate change effects on polar ice formations. The three-month mission would test both her scientific expertise and her ability to endure one of Earth's most challenging environments.
                
                The research station consisted of several interconnected modules designed to withstand extreme weather conditions. Advanced equipment for ice core sampling, meteorological monitoring, and satellite communication filled the laboratories. Sarah's team of six researchers would work in shifts to maintain continuous data collection, even during the harsh winter months when temperatures dropped below minus forty degrees Celsius.
                
                Their primary objective involved analyzing ice cores dating back thousands of years. These frozen time capsules contained atmospheric data that could reveal patterns of climate change throughout history. By comparing historical data with current measurements, the team hoped to develop more accurate predictions about future environmental changes.
                
                As Sarah unpacked her equipment, she felt the weight of their mission's importance. The data they collected would contribute to global understanding of climate science and potentially influence policy decisions affecting millions of people worldwide."""
        
        elif config.mood == "analytical":
            if config.grade <= 6:
                title = "The Science Fair Investigation"
                passage = """Emma noticed something strange happening in her school's garden. Some plants were growing much better than others, even though they were the same type and planted at the same time. She decided to investigate this mystery for her science fair project.
                
                First, Emma carefully observed the garden for several days. She measured the height of different plants and noted their locations. She discovered that plants near the east side of the garden grew taller and had greener leaves than those on the west side. This observation led her to form a hypothesis about sunlight affecting plant growth.
                
                To test her idea, Emma designed an experiment. She planted identical seeds in two groups: one group received morning sunlight, while the other group was placed in a shadier area. She watered both groups equally and measured their growth every day for three weeks. Emma recorded all her data in a detailed chart.
                
                The results confirmed her hypothesis. Plants with more sunlight grew significantly taller and developed more leaves. Emma's systematic approach to solving the garden mystery earned her first place at the science fair. Her project demonstrated how careful observation and scientific thinking can help us understand the natural world around us."""
            else:
                title = "Data Analysis in Modern Healthcare"
                passage = """The integration of artificial intelligence in medical diagnosis represents a revolutionary advancement in healthcare technology. Dr. Martinez, a radiologist at Metropolitan Hospital, recently implemented an AI system designed to assist in detecting abnormalities in medical imaging. This sophisticated software analyzes thousands of X-rays, MRIs, and CT scans with remarkable precision and speed.
                
                The AI system utilizes machine learning algorithms trained on millions of medical images from diverse patient populations. These algorithms identify patterns that might be overlooked by human examination, particularly in early-stage diseases where symptoms are subtle. However, the technology serves as a diagnostic aid rather than a replacement for medical expertise, requiring human verification of all findings.
                
                Initial results from the pilot program show promising outcomes. The AI system successfully identified 94% of abnormalities that were later confirmed by specialist reviews. More importantly, it flagged several cases of early-stage conditions that might have been missed during routine examinations. This early detection capability could significantly improve patient outcomes and reduce treatment costs.
                
                Despite these advantages, implementing AI in healthcare raises important questions about data privacy, algorithmic bias, and the evolving role of medical professionals. Dr. Martinez emphasizes that successful integration requires careful consideration of these ethical and practical challenges while maintaining the highest standards of patient care."""
        
        elif config.mood == "relaxed":
            if config.grade <= 6:
                title = "A Perfect Afternoon at the Park"
                passage = """Sophie and her grandmother decided to spend their Saturday afternoon at Willowbrook Park. The warm spring day was perfect for their weekly visit. They brought a picnic blanket, some sandwiches, and a thermos of lemonade to enjoy under their favorite oak tree.
                
                The park was peaceful and beautiful. Colorful flowers bloomed in carefully tended gardens, and a gentle breeze rustled through the tree leaves. Families were scattered across the grass, some flying kites while others played gentle games of frisbee. The sound of children's laughter mixed with the cheerful songs of birds created a harmony that made everyone feel happy and relaxed.
                
                After lunch, Sophie and her grandmother took a slow walk around the pond. Ducks glided gracefully across the calm water, occasionally dipping their heads to search for food. An elderly man sat on a nearby bench, reading his newspaper and smiling at the peaceful scene. Sophie noticed how the afternoon sunlight created beautiful reflections on the water's surface.
                
                As the day grew later, Sophie felt grateful for these quiet moments with her grandmother. The park provided the perfect setting for their conversations and shared memories. Walking home together, they were already planning their next visit to this special place."""
            else:
                title = "The Art of Mindful Living"
                passage = """In our increasingly fast-paced world, the practice of mindfulness has emerged as a valuable tool for maintaining mental well-being and emotional balance. Mindfulness, rooted in ancient meditation traditions, involves paying deliberate attention to the present moment without judgment or distraction. This simple yet profound practice has gained scientific recognition for its numerous psychological and physiological benefits.
                
                Research conducted at leading universities demonstrates that regular mindfulness practice can reduce stress hormones, lower blood pressure, and improve immune system function. Participants in mindfulness programs report enhanced emotional regulation, increased focus, and greater life satisfaction. The practice involves techniques such as conscious breathing, body awareness, and observational meditation that can be incorporated into daily routines.
                
                Many people find that mindfulness helps them appreciate simple pleasures often overlooked in busy schedules. Whether savoring a cup of tea, listening to rain, or feeling sunshine on their skin, practitioners learn to find joy in ordinary moments. This shift in perspective can lead to reduced anxiety about future events and decreased rumination about past experiences.
                
                The beauty of mindfulness lies in its accessibility. No special equipment or extensive training is required to begin practicing. Even five minutes of daily mindful breathing can create noticeable improvements in overall well-being, making this ancient wisdom relevant for modern life challenges."""
        
        elif config.mood == "curious":
            if config.grade <= 6:
                title = "The Mystery of the Disappearing Cookies"
                passage = """Mrs. Johnson's third-grade class was puzzled. Every morning, she brought homemade cookies to share during snack time, but lately, some cookies had been disappearing before class started. The children were curious about this mystery and decided to investigate.
                
                Tommy suggested they should look for clues like real detectives. The class examined the cookie jar carefully and found small crumbs leading toward the window. Maria noticed that the window was always slightly open, which seemed suspicious. Why would someone leave the window open during cool morning hours?
                
                The next day, the students arrived early to observe the classroom. Hidden behind their desks, they watched quietly as a small squirrel squeezed through the open window. The clever animal went straight to the cookie jar, took a cookie in its mouth, and scampered back outside. The mystery was solved!
                
                Instead of being upset, Mrs. Johnson and her students were delighted by their discovery. They decided to leave a few cookies specifically for their furry visitor and moved the rest to a squirrel-proof container. The children learned that curiosity and careful observation could help them understand the world around them in surprising ways."""
            else:
                title = "The Enigma of Deep Ocean Exploration"
                passage = """Scientists estimate that humans have explored less than five percent of Earth's oceans, leaving vast underwater territories more mysterious than the surface of Mars. The deep ocean, particularly areas beyond 6,000 meters depth, harbors ecosystems that challenge our understanding of life itself. Recent technological advances in submersible design and remote sensing have begun to unveil some of these oceanic secrets.
                
                Researchers have discovered extraordinary organisms thriving in extreme conditions previously thought uninhabitable. Near hydrothermal vents, where temperatures exceed 400 degrees Celsius, unique bacteria convert chemical energy into food through processes unlike photosynthesis. These findings suggest that life might exist in similar extreme environments throughout the universe, revolutionizing astrobiology research.
                
                The deep ocean also contains geological features that dwarf terrestrial mountains. Underwater mountain ranges, called mid-ocean ridges, stretch for thousands of kilometers and play crucial roles in regulating Earth's climate through ocean circulation patterns. These formations influence global weather systems in ways scientists are still working to comprehend.
                
                Perhaps most intriguingly, new species are discovered regularly in deep-sea expeditions. From bioluminescent jellyfish to giant tube worms, these creatures possess adaptations that inspire biotechnology innovations. Each discovery raises new questions about evolution, adaptation, and the interconnectedness of marine ecosystems, ensuring that ocean exploration remains one of science's most fascinating frontiers."""
        
        elif config.mood == "creative":
            if config.grade <= 6:
                title = "The Magical Art Studio"
                passage = """Lily discovered an old art studio in her grandmother's attic. Dust covered everything, but she could see easels, paintbrushes, and canvases scattered around the room. When she touched an old paintbrush, something amazing happened—the brush began to glow with a soft, golden light.
                
                As Lily picked up the magical paintbrush, colors seemed to dance in the air around her. She dipped the brush in dried paint, and suddenly the paint became fresh and vibrant again. When she touched the brush to a blank canvas, beautiful images appeared as if they were painting themselves. Flowers bloomed across the canvas in brilliant colors she had never seen before.
                
                The magical studio seemed to respond to Lily's imagination. When she thought about her pet cat, the brush painted a perfect portrait with whiskers that seemed to twitch. When she imagined flying through clouds, the canvas filled with a sky scene so realistic she felt like she could step right into it.
                
                Lily spent the entire afternoon creating magnificent artwork with the enchanted paintbrush. Each painting captured not just images, but emotions and dreams. When her grandmother found her in the studio, she smiled knowingly and told Lily that creativity had always been the most powerful magic in their family."""
            else:
                title = "Innovation in Urban Architecture"
                passage = """Contemporary urban architects are revolutionizing city design through innovative approaches that prioritize sustainability, community engagement, and adaptive functionality. These visionary designers challenge traditional concepts of urban space by creating buildings that serve multiple purposes while minimizing environmental impact. Their work represents a paradigm shift from purely aesthetic considerations to holistic design solutions.
                
                Vertical gardens and living walls have become integral features of modern urban buildings. These bio-architectural elements not only provide visual appeal but also improve air quality, regulate building temperatures, and create habitats for urban wildlife. Some architects incorporate rooftop farms and community gardens that supply fresh produce to building residents while fostering social connections among neighbors.
                
                Smart building technologies enable structures to adapt to changing needs and environmental conditions. Automated systems adjust lighting, ventilation, and energy consumption based on occupancy patterns and weather conditions. Some buildings feature modular designs that allow spaces to be reconfigured for different uses throughout the day, maximizing utility while minimizing resource consumption.
                
                The most innovative architects collaborate directly with communities to ensure their designs reflect local needs and cultural values. This participatory approach results in buildings that serve as community hubs rather than mere shelters. By integrating art installations, flexible public spaces, and sustainable technologies, these architects create environments that inspire creativity while addressing practical urban challenges."""
        
        else:  # Default and other moods
            if config.grade <= 6:
                title = "The Helpful Robot"
                passage = """At Jefferson Elementary School, a special robot named Helper joined the custodial staff. Helper was designed to assist with cleaning tasks and help students learn about technology. The robot had sensors that helped it navigate the hallways safely and arms that could pick up trash and organize supplies.
                
                Students were initially nervous about the mechanical assistant, but Helper quickly proved to be friendly and useful. The robot's LED screen displayed happy faces and encouraging messages throughout the day. When students dropped their lunch boxes or papers, Helper would politely pick them up and return them with a cheerful beep.
                
                Helper also served as a teaching tool during science class. Students learned about programming, sensors, and artificial intelligence by observing how the robot made decisions and completed tasks. The robot could answer simple questions about its functions and even played educational games with the children during recess.
                
                By the end of the school year, Helper had become a beloved member of the school community. Students learned that technology could be both helpful and friendly when designed with care and good intentions. The robot demonstrated how innovation could improve daily life while bringing people together through shared learning experiences."""
            else:
                title = "Sustainable Technology Solutions"
                passage = """The convergence of renewable energy technologies and smart grid systems represents a crucial advancement in addressing global climate challenges. Modern solar panels and wind turbines generate clean electricity more efficiently than ever before, while intelligent distribution networks optimize energy delivery to reduce waste and improve reliability. These integrated systems provide scalable solutions for both urban and rural communities worldwide.
                
                Energy storage technology has overcome previous limitations through innovations in battery chemistry and grid-scale storage solutions. Lithium-ion batteries, compressed air systems, and hydrogen fuel cells now enable communities to store renewable energy for use during periods of low generation. This capability addresses the intermittent nature of solar and wind power, making renewable energy sources more reliable and practical.
                
                Smart home technologies allow individual households to participate actively in energy conservation efforts. Automated systems monitor electricity usage patterns and adjust consumption based on grid demand and energy prices. Some homes generate excess renewable energy that can be sold back to utility companies, creating economic incentives for sustainable living practices.
                
                The implementation of these technologies requires significant infrastructure investments and policy support. However, economic analyses demonstrate that the long-term benefits, including reduced healthcare costs from improved air quality and decreased dependence on fossil fuel imports, justify the initial expenditures. Success depends on coordinated efforts among governments, industries, and communities to prioritize sustainable development goals."""
        
        return passage.strip(), title

    def create_comprehension_questions(self, passage: str, config: ContentConfig) -> List[Dict[str, Any]]:
        """Create 4-5 multiple choice questions about the passage"""
        questions = []
        
        # Question types based on grade level and difficulty
        if config.grade <= 6:
            question_types = ["main_idea", "detail", "vocabulary", "inference"]
        else:
            question_types = ["main_idea", "detail", "vocabulary", "inference", "analysis"]
        
        # Generate questions based on passage content and mood
        for i, q_type in enumerate(question_types[:4]):  # Generate 4 questions per passage
            question_data = self.create_specific_question(passage, q_type, config, i+1)
            questions.append(question_data)
        
        return questions

    def create_specific_question(self, passage: str, question_type: str, config: ContentConfig, question_num: int) -> Dict[str, Any]:
        """Create a specific type of comprehension question"""
        
        question_id = f"q{question_num}"
        
        if config.mood == "adventurous":
            if question_type == "main_idea":
                if config.grade <= 6:
                    question_text = "What is the main idea of this passage?"
                    options = {
                        "A": "Maya likes to draw pictures of nature",
                        "B": "Maya discovers an old stone structure while exploring the forest",
                        "C": "Maya's family moved to a new house",
                        "D": "The forest has many different types of trees"
                    }
                    correct_answer = "B"
                    explanation = "The passage focuses on Maya's discovery of the stone structure during her forest exploration."
                else:
                    question_text = "What is the primary purpose of Dr. Chen's Arctic expedition?"
                    options = {
                        "A": "To test new helicopter technology in extreme conditions",
                        "B": "To build a permanent research facility in the Arctic",
                        "C": "To collect ice core data for climate change research",
                        "D": "To study Arctic wildlife migration patterns"
                    }
                    correct_answer = "C"
                    explanation = "The passage clearly states that Dr. Chen's mission involves collecting ice core data to study climate change."
            
            elif question_type == "detail":
                if config.grade <= 6:
                    question_text = "What equipment did Maya bring with her to explore the forest?"
                    options = {
                        "A": "Backpack, compass, and notebook",
                        "B": "Camera, map, and water bottle",
                        "C": "Flashlight, rope, and first aid kit",
                        "D": "Binoculars, GPS, and snacks"
                    }
                    correct_answer = "A"
                    explanation = "The passage specifically mentions Maya brought a backpack, compass, and notebook."
                else:
                    question_text = "How long is the Arctic research mission scheduled to last?"
                    options = {
                        "A": "One month",
                        "B": "Two months", 
                        "C": "Three months",
                        "D": "Six months"
                    }
                    correct_answer = "C"
                    explanation = "The passage states the mission would last three months."
            
            elif question_type == "vocabulary":
                if config.grade <= 6:
                    question_text = "In the passage, what does 'venture' mean?"
                    options = {
                        "A": "To return quickly",
                        "B": "To go somewhere despite risks",
                        "C": "To walk very slowly",
                        "D": "To call for help"
                    }
                    correct_answer = "B"
                    explanation = "'Venture' means to go somewhere that might involve risk or uncertainty."
                else:
                    question_text = "What does 'glaciologist' mean in the context of this passage?"
                    options = {
                        "A": "A scientist who studies ocean currents",
                        "B": "A scientist who studies ice and glaciers",
                        "C": "A scientist who studies Arctic animals",
                        "D": "A scientist who studies weather patterns"
                    }
                    correct_answer = "B"
                    explanation = "A glaciologist is a scientist who specializes in studying ice formations and glaciers."
            
            elif question_type == "inference":
                if config.grade <= 6:
                    question_text = "Based on the passage, what can you infer about Maya's personality?"
                    options = {
                        "A": "She is afraid of new experiences",
                        "B": "She is curious and adventurous",
                        "C": "She prefers to stay indoors",
                        "D": "She dislikes researching information"
                    }
                    correct_answer = "B"
                    explanation = "Maya's actions show she is curious and willing to explore, demonstrating an adventurous personality."
                else:
                    question_text = "What can be inferred about the importance of this research mission?"
                    options = {
                        "A": "It is mainly for Dr. Chen's personal career advancement",
                        "B": "The results could influence global environmental policies",
                        "C": "It is a routine data collection with limited impact",
                        "D": "The research is only important for Arctic communities"
                    }
                    correct_answer = "B"
                    explanation = "The passage suggests the data could influence policy decisions affecting millions worldwide."
        
        elif config.mood == "analytical":
            if question_type == "main_idea":
                if config.grade <= 6:
                    question_text = "What is the main focus of Emma's science fair project?"
                    options = {
                        "A": "Comparing different types of garden soil",
                        "B": "Investigating why some plants grow better than others",
                        "C": "Testing different watering techniques",
                        "D": "Studying insect behavior in gardens"
                    }
                    correct_answer = "B"
                    explanation = "Emma's project focuses on investigating why some plants in the garden grew better than others."
                else:
                    question_text = "What is the main topic of this passage?"
                    options = {
                        "A": "The history of artificial intelligence development",
                        "B": "Dr. Martinez's career in radiology",
                        "C": "The integration of AI in medical diagnosis",
                        "D": "The cost of modern healthcare technology"
                    }
                    correct_answer = "C"
                    explanation = "The passage primarily discusses how AI is being integrated into medical diagnostic processes."
            
            elif question_type == "detail":
                if config.grade <= 6:
                    question_text = "How did Emma test her hypothesis about sunlight and plant growth?"
                    options = {
                        "A": "She planted seeds in different types of soil",
                        "B": "She gave some plants more water than others",
                        "C": "She placed one group in sunlight and another in shade",
                        "D": "She used different types of fertilizer"
                    }
                    correct_answer = "C"
                    explanation = "Emma tested her hypothesis by placing one group of plants in sunlight and another in a shadier area."
                else:
                    question_text = "What percentage of abnormalities did the AI system successfully identify?"
                    options = {
                        "A": "84%",
                        "B": "89%",
                        "C": "94%",
                        "D": "98%"
                    }
                    correct_answer = "C"
                    explanation = "The passage states the AI system identified 94% of abnormalities confirmed by specialists."
            
            elif question_type == "vocabulary":
                if config.grade <= 6:
                    question_text = "What does 'hypothesis' mean in this passage?"
                    options = {
                        "A": "A final conclusion",
                        "B": "An educated guess to be tested",
                        "C": "A type of scientific equipment", 
                        "D": "A mistake in reasoning"
                    }
                    correct_answer = "B"
                    explanation = "A hypothesis is an educated guess or prediction that can be tested through experimentation."
                else:
                    question_text = "What does 'algorithmic bias' refer to in this context?"
                    options = {
                        "A": "Personal preferences of programmers",
                        "B": "Unfairness in AI decision-making processes",
                        "C": "The speed of computer calculations",
                        "D": "The cost of implementing AI systems"
                    }
                    correct_answer = "B"
                    explanation = "Algorithmic bias refers to unfair or discriminatory outcomes in AI decision-making systems."
            
            elif question_type == "inference":
                if config.grade <= 6:
                    question_text = "What can you conclude about Emma's approach to solving problems?"
                    options = {
                        "A": "She relies on guessing rather than testing",
                        "B": "She uses systematic observation and experimentation",
                        "C": "She prefers to ask others for answers",
                        "D": "She avoids difficult challenges"
                    }
                    correct_answer = "B"
                    explanation = "Emma demonstrates systematic scientific thinking through observation, hypothesis formation, and testing."
                else:
                    question_text = "What can be inferred about the future role of AI in healthcare?"
                    options = {
                        "A": "AI will completely replace human doctors",
                        "B": "AI will serve as a diagnostic aid requiring human oversight",
                        "C": "AI is too unreliable for medical use",
                        "D": "AI will only be used for administrative tasks"
                    }
                    correct_answer = "B"
                    explanation = "The passage emphasizes AI serves as diagnostic aid requiring human verification, not replacement."
        
        # Similar patterns for other moods...
        else:  # Default questions for other moods
            if question_type == "main_idea":
                question_text = "What is the main idea of this passage?"
                options = {
                    "A": "Option A",
                    "B": "Option B", 
                    "C": "Option C",
                    "D": "Option D"
                }
                correct_answer = "B"
                explanation = "This is the correct answer based on the passage content."
            
            elif question_type == "detail":
                question_text = "According to the passage, what specific detail is mentioned?"
                options = {
                    "A": "Detail A",
                    "B": "Detail B",
                    "C": "Detail C", 
                    "D": "Detail D"
                }
                correct_answer = "C"
                explanation = "This detail is specifically stated in the passage."
            
            elif question_type == "vocabulary":
                question_text = "What does the word 'example' mean in this context?"
                options = {
                    "A": "Definition A",
                    "B": "Definition B",
                    "C": "Definition C",
                    "D": "Definition D"
                }
                correct_answer = "A"
                explanation = "This definition best fits the context of the passage."
            
            elif question_type == "inference":
                question_text = "What can you infer from the information in the passage?"
                options = {
                    "A": "Inference A",
                    "B": "Inference B", 
                    "C": "Inference C",
                    "D": "Inference D"
                }
                correct_answer = "D"
                explanation = "This inference is supported by evidence in the passage."
        
        return {
            "question_id": question_id,
            "question_text": question_text,
            "options": options,
            "correct_answer": correct_answer,
            "explanation": explanation,
            "question_type": question_type
        }

    def generate_complete_dataset(self, config: ContentConfig) -> List[Dict[str, Any]]:
        """Generate a complete dataset with all question types"""
        all_questions = []
        
        print(f"Generating content for Grade {config.grade}, Mood: {config.mood}, Difficulty: {config.difficulty}")
        
        # Generate different types of questions
        all_questions.extend(self.generate_vocabulary_questions(config, 200))  # Reduced count
        all_questions.extend(self.generate_sentence_correction(config, 200))
        all_questions.extend(self.generate_fill_in_blanks(config, 200))
        all_questions.extend(self.generate_incorrect_sentence_identification(config, 200))
        all_questions.extend(self.generate_grammar_questions(config, 200))
        all_questions.extend(self.generate_reading_comprehension(config, 500))  # New reading comprehension
        
        print(f"Generated {len(all_questions)} total questions")
        return all_questions

def main():
    """Main function to run the content generator"""
    generator = EducationalContentGenerator()
    
    # Example configurations - you can modify these
    configs = [
        # Grade 5 (V) - ISEE Primary Level
        ContentConfig(grade=5, mood="adventurous", difficulty=1, test_type="isee"),
        ContentConfig(grade=5, mood="analytical", difficulty=2, test_type="isee"),
        ContentConfig(grade=5, mood="social", difficulty=1, test_type="isee"),
        ContentConfig(grade=5, mood="practical", difficulty=3, test_type="isee"),
        ContentConfig(grade=5, mood="creative", difficulty=2, test_type="isee"),
        
        # Grade 6 (VI) - ISEE Lower Level
        ContentConfig(grade=6, mood="analytical", difficulty=3, test_type="isee"),
        ContentConfig(grade=6, mood="competitive", difficulty=4, test_type="isee"),
        ContentConfig(grade=6, mood="curious", difficulty=2, test_type="isee"),
        ContentConfig(grade=6, mood="relaxed", difficulty=3, test_type="isee"),
        ContentConfig(grade=6, mood="creative", difficulty=4, test_type="isee"),
        
        # Grade 7 (VII) - ISEE Lower Level & Pre-SAT Introduction
        ContentConfig(grade=7, mood="adventurous", difficulty=4, test_type="isee"),
        ContentConfig(grade=7, mood="social", difficulty=3, test_type="presat"),
        ContentConfig(grade=7, mood="analytical", difficulty=5, test_type="presat"),
        ContentConfig(grade=7, mood="competitive", difficulty=4, test_type="isee"),
        ContentConfig(grade=7, mood="practical", difficulty=4, test_type="presat"),
        
        # Grade 8 (VIII) - ISEE Middle Level & Pre-SAT
        ContentConfig(grade=8, mood="chill", difficulty=4, test_type="isee"),
        ContentConfig(grade=8, mood="curious", difficulty=5, test_type="presat"),
        ContentConfig(grade=8, mood="creative", difficulty=5, test_type="isee"),
        ContentConfig(grade=8, mood="relaxed", difficulty=4, test_type="presat"),
        ContentConfig(grade=8, mood="adventurous", difficulty=6, test_type="presat"),
        
        # Grade 9 (IX) - ISEE Upper Level, Pre-SAT, IB MYP
        ContentConfig(grade=9, mood="analytical", difficulty=6, test_type="isee"),
        ContentConfig(grade=9, mood="competitive", difficulty=5, test_type="presat"),
        ContentConfig(grade=9, mood="social", difficulty=5, test_type="ib"),
        ContentConfig(grade=9, mood="practical", difficulty=6, test_type="ib"),
        ContentConfig(grade=9, mood="curious", difficulty=6, test_type="presat"),
        
        # Grade 10 (X) - SAT, ISEE Upper Level, IB DP Year 1
        ContentConfig(grade=10, mood="adventurous", difficulty=7, test_type="sat"),
        ContentConfig(grade=10, mood="chill", difficulty=6, test_type="isee"),
        ContentConfig(grade=10, mood="analytical", difficulty=7, test_type="ib"),
        ContentConfig(grade=10, mood="creative", difficulty=6, test_type="sat"),
        ContentConfig(grade=10, mood="competitive", difficulty=7, test_type="sat"),
        ContentConfig(grade=10, mood="relaxed", difficulty=6, test_type="ib"),
        
        # Grade 11 (XI) - SAT, AP, IB DP Year 2
        ContentConfig(grade=11, mood="social", difficulty=8, test_type="sat"),
        ContentConfig(grade=11, mood="practical", difficulty=7, test_type="ap"),
        ContentConfig(grade=11, mood="analytical", difficulty=8, test_type="ap"),
        ContentConfig(grade=11, mood="curious", difficulty=7, test_type="ib"),
        ContentConfig(grade=11, mood="adventurous", difficulty=8, test_type="sat"),
        ContentConfig(grade=11, mood="competitive", difficulty=9, test_type="ap"),
        ContentConfig(grade=11, mood="creative", difficulty=8, test_type="ib"),
        ContentConfig(grade=11, mood="chill", difficulty=7, test_type="sat"),
        ContentConfig(grade=11, mood="relaxed", difficulty=8, test_type="ap"),
        
        # Additional high-difficulty configurations for advanced students
        ContentConfig(grade=10, mood="analytical", difficulty=9, test_type="ap"),
        ContentConfig(grade=11, mood="practical", difficulty=9, test_type="sat"),
        ContentConfig(grade=9, mood="adventurous", difficulty=7, test_type="ib"),
        ContentConfig(grade=8, mood="competitive", difficulty=6, test_type="presat"),
        
        # Mixed configurations for comprehensive coverage
        ContentConfig(grade=6, mood="adventurous", difficulty=3, test_type="isee"),
        ContentConfig(grade=7, mood="chill", difficulty=5, test_type="presat"),
        ContentConfig(grade=8, mood="social", difficulty=5, test_type="isee"),
        ContentConfig(grade=9, mood="relaxed", difficulty=6, test_type="presat"),
        ContentConfig(grade=10, mood="curious", difficulty=8, test_type="ib"),
        ContentConfig(grade=11, mood="social", difficulty=9, test_type="ib"),
    ]
    
    all_questions = []
    
    for config in configs:
        questions = generator.generate_complete_dataset(config)
        all_questions.extend(questions)
    
    # Save to JSON file as backup
    with open('educational_content.json', 'w') as f:
        json.dump(all_questions, f, indent=2)
    print(f"Saved {len(all_questions)} questions to educational_content.json")
    
    # Upload to Supabase
    success = generator.upload_to_supabase(all_questions)
    
    if success:
        print("Content generation and upload completed successfully!")
    else:
        print("Content generated but upload failed. Check your Supabase configuration.")

if __name__ == "__main__":
    # Set environment variables before running
    # export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
    # export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
    main()