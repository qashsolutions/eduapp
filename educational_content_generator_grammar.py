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
            
            # Create a simple hash for the question content
            import hashlib
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

    def generate_complete_dataset(self, config: ContentConfig) -> List[Dict[str, Any]]:
        """Generate a complete dataset with all question types"""
        all_questions = []
        
        print(f"Generating content for Grade {config.grade}, Mood: {config.mood}, Difficulty: {config.difficulty}")
        
        # Generate different types of questions
        all_questions.extend(self.generate_vocabulary_questions(config, 2000))
        all_questions.extend(self.generate_sentence_correction(config, 2000))
        all_questions.extend(self.generate_fill_in_blanks(config, 2000))
        all_questions.extend(self.generate_incorrect_sentence_identification(config, 2000))
        all_questions.extend(self.generate_grammar_questions(config, 2000))
        
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