#!/usr/bin/env python3
"""
Safe Vocabulary Question Generator for EduApp
Generates COPPA-compliant vocabulary questions with guaranteed correct answers
"""

import json
import random
import hashlib
import os
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from dotenv import load_dotenv
from supabase import create_client, Client
import logging

# Load environment variables
load_dotenv('.env.local')
load_dotenv('.env', override=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Missing Supabase credentials. Please check .env.local or .env files")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

@dataclass
class VocabularyQuestion:
    """Structure for vocabulary questions"""
    topic: str = "english_vocabulary"
    grade: int = 7
    difficulty: int = 5
    mood: str = "curious"
    question: Dict[str, Any] = None
    ai_model: str = "code_generated"
    question_hash: str = ""

class SafeVocabularyGenerator:
    """Generate vocabulary questions with guaranteed correct answers"""
    
    def __init__(self):
        # Vocabulary definitions by grade level - COPPA compliant
        self.vocabulary_data = {
            5: [
                # Format: (word, definition, wrong_definitions)
                ("adventure", "an exciting or dangerous journey", 
                 ["a type of food", "a mathematical equation", "a piece of furniture"]),
                ("courage", "the ability to face fear or danger", 
                 ["a type of plant", "a musical instrument", "a weather condition"]),
                ("discover", "to find something new or learn something for the first time", 
                 ["to break something", "to sleep deeply", "to run quickly"]),
                ("imagine", "to form a picture or idea in your mind", 
                 ["to eat quickly", "to jump high", "to sing loudly"]),
                ("patient", "able to wait calmly without getting upset", 
                 ["a type of bird", "very cold", "extremely loud"]),
                ("valuable", "worth a lot of money or very important", 
                 ["very small", "completely wet", "extremely hot"]),
                ("ancient", "very old or from long ago", 
                 ["brand new", "very tall", "extremely fast"]),
                ("gentle", "kind, calm, and careful", 
                 ["very loud", "extremely hot", "completely wet"]),
                ("curious", "wanting to know or learn about something", 
                 ["very tired", "extremely cold", "completely full"]),
                ("peaceful", "quiet and calm without war or violence", 
                 ["very loud", "extremely fast", "completely broken"]),
            ],
            6: [
                ("analyze", "to study something carefully to understand it", 
                 ["to cook food", "to play music", "to paint pictures"]),
                ("demonstrate", "to show how something works or prove something is true", 
                 ["to hide something", "to break something", "to forget something"]),
                ("evidence", "facts or signs that show something is true", 
                 ["a type of dance", "a cooking tool", "a weather pattern"]),
                ("hypothesis", "an educated guess that can be tested", 
                 ["a type of animal", "a musical note", "a food ingredient"]),
                ("observe", "to watch carefully and notice details", 
                 ["to sing loudly", "to run fast", "to sleep deeply"]),
                ("significant", "important or having a special meaning", 
                 ["very small", "extremely cold", "completely empty"]),
                ("strategy", "a plan to achieve a goal", 
                 ["a type of tree", "a kitchen tool", "a weather condition"]),
                ("technique", "a special way of doing something", 
                 ["a type of food", "a body part", "a time of day"]),
                ("essential", "absolutely necessary or very important", 
                 ["completely optional", "very small", "extremely cold"]),
                ("perspective", "a particular way of viewing things", 
                 ["a type of fruit", "a math problem", "a kitchen tool"]),
            ],
            7: [
                ("ambiguous", "having more than one possible meaning", 
                 ["very clear", "extremely hot", "completely empty"]),
                ("collaborate", "to work together with others", 
                 ["to work alone", "to sleep deeply", "to eat quickly"]),
                ("contradict", "to say the opposite of what was said before", 
                 ["to agree completely", "to sing a song", "to draw a picture"]),
                ("emphasize", "to give special importance or attention to something", 
                 ["to ignore completely", "to eat quickly", "to run fast"]),
                ("innovative", "introducing new ideas or methods", 
                 ["very old-fashioned", "extremely cold", "completely wet"]),
                ("phenomenon", "something that exists and can be observed", 
                 ["a type of sandwich", "a musical instrument", "a piece of clothing"]),
                ("legitimate", "allowed by law or reasonable and acceptable", 
                 ["completely illegal", "very small", "extremely hot"]),
                ("manipulate", "to control or influence cleverly", 
                 ["to ignore completely", "to sleep deeply", "to sing loudly"]),
                ("perceive", "to understand or think of something in a particular way", 
                 ["to cook food", "to build houses", "to grow plants"]),
                ("substantial", "large in size, value, or importance", 
                 ["extremely tiny", "completely empty", "very cold"]),
            ],
            8: [
                ("abstract", "existing as an idea rather than a physical thing", 
                 ["very concrete", "extremely hot", "completely wet"]),
                ("advocate", "to speak in support of an idea or cause", 
                 ["to oppose strongly", "to sleep deeply", "to eat quickly"]),
                ("comprehensive", "including everything that is necessary", 
                 ["very limited", "extremely cold", "completely empty"]),
                ("fluctuate", "to change continuously between different levels", 
                 ["to remain constant", "to disappear completely", "to grow wings"]),
                ("implication", "a possible effect or result of an action", 
                 ["a type of food", "a musical note", "a piece of furniture"]),
                ("inevitable", "certain to happen and cannot be prevented", 
                 ["easily avoidable", "very small", "extremely cold"]),
                ("paradox", "a situation that seems impossible but is actually true", 
                 ["a simple solution", "a type of bird", "a cooking method"]),
                ("predominant", "the most common or strongest", 
                 ["very rare", "extremely cold", "completely empty"]),
                ("skeptical", "having doubts or not easily convinced", 
                 ["easily convinced", "very hungry", "extremely tired"]),
                ("theoretical", "based on ideas rather than practical experience", 
                 ["very practical", "extremely hot", "completely wet"]),
            ],
            9: [
                ("autonomous", "able to govern itself or control its own affairs", 
                 ["completely dependent", "very cold", "extremely small"]),
                ("catalyst", "something that causes an important change or event", 
                 ["something that prevents change", "a type of food", "a musical instrument"]),
                ("divergent", "moving in different directions from a common point", 
                 ["moving together", "staying still", "disappearing completely"]),
                ("empirical", "based on observation or experience rather than theory", 
                 ["purely theoretical", "very cold", "extremely small"]),
                ("inherent", "existing as a natural or permanent quality", 
                 ["artificially added", "completely missing", "temporarily present"]),
                ("nuance", "a small difference in meaning or expression", 
                 ["a huge difference", "a type of dance", "a cooking tool"]),
                ("paradigm", "a typical example or model of something", 
                 ["a complete opposite", "a type of fruit", "a weather pattern"]),
                ("reciprocal", "given or felt by each toward the other", 
                 ["one-sided only", "very cold", "extremely small"]),
                ("synthesis", "combining different ideas to form a new whole", 
                 ["breaking apart completely", "a type of animal", "a musical note"]),
                ("ubiquitous", "present everywhere at the same time", 
                 ["found nowhere", "very cold", "extremely small"]),
            ],
            10: [
                ("analogous", "similar in some ways but not identical", 
                 ["completely different", "exactly the same", "totally unrelated"]),
                ("dichotomy", "a division into two opposite groups", 
                 ["a unity of all parts", "a type of plant", "a cooking method"]),
                ("ephemeral", "lasting for a very short time", 
                 ["lasting forever", "very heavy", "extremely hot"]),
                ("hegemony", "leadership or dominance by one group", 
                 ["equal power sharing", "a type of food", "a weather condition"]),
                ("idiosyncratic", "peculiar to an individual", 
                 ["common to everyone", "very cold", "extremely small"]),
                ("juxtaposition", "placing two things side by side for comparison", 
                 ["keeping things far apart", "a type of dance", "a cooking tool"]),
                ("metamorphosis", "a complete change in form or nature", 
                 ["staying exactly the same", "a type of fruit", "a musical instrument"]),
                ("quintessential", "representing the perfect example of something", 
                 ["the worst example", "completely unrelated", "partially similar"]),
                ("symbiotic", "involving mutual benefit between different organisms", 
                 ["completely independent", "very harmful", "totally separate"]),
                ("transcendent", "going beyond ordinary limits", 
                 ["staying within limits", "very cold", "extremely small"]),
            ],
            11: [
                ("ameliorate", "to make something better or less painful", 
                 ["to make worse", "to keep the same", "to destroy completely"]),
                ("confluence", "a coming together of people or things", 
                 ["a separation of all parts", "a type of bird", "a cooking method"]),
                ("derivative", "something based on another source", 
                 ["completely original", "very cold", "extremely small"]),
                ("enigmatic", "mysterious and difficult to understand", 
                 ["very clear and obvious", "extremely hot", "completely wet"]),
                ("ineffable", "too great to be expressed in words", 
                 ["easily described", "very small", "completely empty"]),
                ("mitigate", "to make less severe or serious", 
                 ["to make more severe", "to ignore completely", "to celebrate loudly"]),
                ("ostensible", "appearing to be true but perhaps not", 
                 ["definitely true", "completely false", "partially visible"]),
                ("pragmatic", "dealing with things in a practical way", 
                 ["completely impractical", "very cold", "extremely small"]),
                ("substantiate", "to provide evidence to support a claim", 
                 ["to disprove completely", "to ignore evidence", "to hide facts"]),
                ("vindicate", "to clear someone of blame or suspicion", 
                 ["to prove guilty", "to ignore completely", "to celebrate loudly"]),
            ]
        }
        
        # Mood-based question formats
        self.mood_formats = {
            "curious": "What does the word '{}' mean?",
            "analytical": "Which definition best describes the word '{}'?",
            "practical": "In everyday use, what does '{}' mean?",
            "competitive": "Select the correct meaning of '{}':",
            "creative": "The word '{}' is best defined as:",
            "adventurous": "Discover the meaning of '{}':",
            "relaxed": "Simply put, '{}' means:",
            "cool": "What's the definition of '{}'?"
        }

    def generate_hash(self, question_text: str, config: Dict) -> str:
        """Generate unique hash for question"""
        content = f"{question_text}_{config['topic']}_{config['grade']}_{config['difficulty']}"
        return hashlib.md5(content.encode()).hexdigest()

    def generate_question(self, grade: int, difficulty: int, mood: str) -> VocabularyQuestion:
        """Generate a single vocabulary question with guaranteed correct answer"""
        
        # Get vocabulary for grade level
        grade_vocab = self.vocabulary_data.get(grade, self.vocabulary_data[7])
        
        # Select word based on difficulty (1-9 scale)
        vocab_count = len(grade_vocab)
        if difficulty <= 3:
            # Easy: first third
            vocab_pool = grade_vocab[:vocab_count//3]
        elif difficulty <= 6:
            # Medium: middle third
            vocab_pool = grade_vocab[vocab_count//3:2*vocab_count//3]
        else:
            # Hard: last third
            vocab_pool = grade_vocab[2*vocab_count//3:]
        
        if not vocab_pool:
            vocab_pool = grade_vocab
        
        # Select random word and its data
        word_data = random.choice(vocab_pool)
        word, correct_definition, wrong_definitions = word_data
        
        # Create question text
        question_format = self.mood_formats.get(mood, self.mood_formats["curious"])
        question_text = question_format.format(word)
        
        # Create options (guaranteed only one correct answer)
        options = [correct_definition] + list(wrong_definitions)
        random.shuffle(options)
        
        # Create question structure matching database format
        question_data = {
            "question_text": question_text,
            "question_type": "multiple_choice",
            "correct_answer": correct_definition,
            "options": options,
            "explanation": f"'{word}' means: {correct_definition}",
            "hints": [
                "Think about the context where you might use this word.",
                f"The word '{word}' has {len(word)} letters.",
                "Eliminate definitions that don't make logical sense.",
                f"Focus on what '{word}' actually means in everyday language."
            ]
        }
        
        # Create config for hash
        config = {
            "topic": "english_vocabulary",
            "grade": grade,
            "difficulty": difficulty
        }
        
        question = VocabularyQuestion(
            topic="english_vocabulary",
            grade=grade,
            difficulty=difficulty,
            mood=mood,
            question=question_data,
            question_hash=self.generate_hash(question_text, config)
        )
        
        return question

    def insert_to_database(self, questions: List[VocabularyQuestion]) -> Tuple[int, int]:
        """Insert questions into Supabase database"""
        success_count = 0
        error_count = 0
        
        for q in questions:
            try:
                data = {
                    "topic": q.topic,
                    "difficulty": q.difficulty,
                    "grade": q.grade,
                    "question": json.dumps(q.question),
                    "ai_model": q.ai_model,
                    "mood": q.mood,
                    "question_hash": q.question_hash,
                    "expires_at": None  # Permanent questions
                }
                
                result = supabase.table('question_cache').insert(data).execute()
                success_count += 1
                
            except Exception as e:
                logger.error(f"Error inserting question: {e}")
                error_count += 1
        
        return success_count, error_count

def main():
    """Main execution function"""
    generator = SafeVocabularyGenerator()
    
    print("Safe Vocabulary Question Generator")
    print("==================================")
    print(f"Database: {SUPABASE_URL}")
    print()
    
    # Configuration
    grades = [5, 6, 7, 8, 9, 10, 11]
    difficulties = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    moods = ["curious", "analytical", "practical", "competitive", 
             "creative", "adventurous", "relaxed", "cool"]
    
    questions_per_combination = 5  # Generate 5 questions for each grade/difficulty/mood combo
    
    all_questions = []
    
    print(f"Generating vocabulary questions...")
    print(f"Grades: {grades}")
    print(f"Difficulties: {difficulties}")
    print(f"Moods: {moods}")
    print(f"Questions per combination: {questions_per_combination}")
    print()
    
    total_combinations = len(grades) * len(difficulties) * len(moods)
    current = 0
    
    for grade in grades:
        for difficulty in difficulties:
            for mood in moods:
                current += 1
                print(f"Progress: {current}/{total_combinations} - Grade {grade}, Difficulty {difficulty}, Mood {mood}", end="\r")
                
                for _ in range(questions_per_combination):
                    question = generator.generate_question(grade, difficulty, mood)
                    all_questions.append(question)
    
    print(f"\nGenerated {len(all_questions)} questions total")
    
    # Insert to database
    print("\nInserting questions to database...")
    success, errors = generator.insert_to_database(all_questions)
    
    print(f"\nResults:")
    print(f"Successfully inserted: {success}")
    print(f"Errors: {errors}")
    print(f"Total questions: {len(all_questions)}")
    
    # Show sample questions
    print("\nSample questions generated:")
    for i in range(min(3, len(all_questions))):
        q = all_questions[i]
        print(f"\nQuestion {i+1}:")
        print(f"  Grade: {q.grade}, Difficulty: {q.difficulty}, Mood: {q.mood}")
        print(f"  Question: {q.question['question_text']}")
        print(f"  Correct Answer: {q.question['correct_answer']}")
        print(f"  Options: {q.question['options']}")

if __name__ == "__main__":
    main()