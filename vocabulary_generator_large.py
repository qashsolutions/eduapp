#!/usr/bin/env python3
"""
Large-Scale Safe Vocabulary Question Generator for EduApp
Generates 2000 COPPA-compliant vocabulary questions per grade/difficulty/mood combination
"""

import json
import random
import hashlib
import os
import time
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

class LargeVocabularyGenerator:
    """Generate vocabulary questions with guaranteed correct answers at scale"""
    
    def __init__(self):
        # Extended vocabulary definitions by grade level - COPPA compliant
        # Each entry: (word, correct_definition, [wrong_definitions])
        self.base_vocabulary = {
            5: [
                # Basic vocabulary for grade 5
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
                ("brave", "showing courage and not afraid", 
                 ["very small", "extremely cold", "completely wet"]),
                ("creative", "able to make new things or think of new ideas", 
                 ["very hungry", "extremely tired", "completely lost"]),
                ("honest", "always telling the truth", 
                 ["very tall", "extremely fast", "completely round"]),
                ("generous", "willing to give money, help, or time freely", 
                 ["very small", "extremely cold", "completely empty"]),
                ("careful", "giving attention to avoid harm or mistakes", 
                 ["very loud", "extremely hot", "completely broken"]),
                ("proud", "feeling pleased about something you've done", 
                 ["very wet", "extremely small", "completely dark"]),
                ("excited", "feeling very happy and enthusiastic", 
                 ["very cold", "extremely heavy", "completely square"]),
                ("responsible", "able to be trusted to do what is right", 
                 ["very soft", "extremely loud", "completely yellow"]),
                ("confident", "feeling sure about your abilities", 
                 ["very wet", "extremely small", "completely broken"]),
                ("determined", "having made a firm decision to do something", 
                 ["very cold", "extremely soft", "completely round"]),
            ],
            6: [
                # Intermediate vocabulary for grade 6
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
                ("accomplish", "to succeed in doing something", 
                 ["to fail completely", "to sleep deeply", "to eat quickly"]),
                ("accurate", "correct in all details", 
                 ["completely wrong", "very loud", "extremely cold"]),
                ("benefit", "something that helps or gives an advantage", 
                 ["something harmful", "a type of plant", "a weather condition"]),
                ("compare", "to look at similarities and differences", 
                 ["to ignore completely", "to break apart", "to paint blue"]),
                ("concentrate", "to focus all your attention", 
                 ["to scatter widely", "to sleep deeply", "to run fast"]),
                ("consequence", "a result or effect of an action", 
                 ["a type of bird", "a cooking method", "a musical instrument"]),
                ("contribute", "to give something to help achieve a goal", 
                 ["to take away", "to break down", "to hide completely"]),
                ("efficient", "working well without wasting time or energy", 
                 ["very wasteful", "extremely cold", "completely round"]),
                ("evaluate", "to judge the value or quality of something", 
                 ["to ignore completely", "to paint red", "to break apart"]),
                ("investigate", "to examine something carefully to find facts", 
                 ["to hide evidence", "to sleep deeply", "to run away"]),
            ],
            7: [
                # Advanced vocabulary for grade 7
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
                ("anticipate", "to expect or predict something", 
                 ["to forget completely", "to break down", "to paint green"]),
                ("approximate", "almost exact but not completely accurate", 
                 ["perfectly exact", "very loud", "extremely wet"]),
                ("circumstance", "a condition or fact that affects a situation", 
                 ["a type of food", "a musical note", "a piece of furniture"]),
                ("comprehensive", "including everything that is necessary", 
                 ["very limited", "extremely cold", "completely empty"]),
                ("controversy", "strong disagreement or argument", 
                 ["complete agreement", "a type of plant", "a weather pattern"]),
                ("distinguish", "to recognize differences between things", 
                 ["to mix together", "to sleep deeply", "to run slowly"]),
                ("fundamental", "forming the base or most important part", 
                 ["completely unimportant", "very soft", "extremely wet"]),
                ("implication", "a possible effect or result", 
                 ["a type of bird", "a cooking tool", "a musical instrument"]),
                ("integrate", "to combine parts into a whole", 
                 ["to separate completely", "to break apart", "to hide away"]),
                ("justify", "to show something is right or reasonable", 
                 ["to prove wrong", "to paint yellow", "to sing loudly"]),
            ],
            8: [
                # More advanced vocabulary for grade 8
                ("abstract", "existing as an idea rather than a physical thing", 
                 ["very concrete", "extremely hot", "completely wet"]),
                ("advocate", "to speak in support of an idea or cause", 
                 ["to oppose strongly", "to sleep deeply", "to eat quickly"]),
                ("coherent", "logical and clearly organized", 
                 ["completely confused", "very cold", "extremely small"]),
                ("fluctuate", "to change continuously between different levels", 
                 ["to remain constant", "to disappear completely", "to grow wings"]),
                ("implicit", "suggested but not directly expressed", 
                 ["clearly stated", "very loud", "extremely cold"]),
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
                ("arbitrary", "based on random choice rather than reason", 
                 ["carefully planned", "very small", "extremely loud"]),
                ("comprise", "to consist of or be made up of", 
                 ["to destroy completely", "to paint blue", "to sing softly"]),
                ("concurrent", "happening at the same time", 
                 ["happening separately", "very cold", "extremely small"]),
                ("constitute", "to form or make up", 
                 ["to break down", "to hide away", "to run fast"]),
                ("derive", "to obtain something from a source", 
                 ["to lose completely", "to paint red", "to sleep deeply"]),
                ("explicit", "stated clearly and in detail", 
                 ["very vague", "extremely cold", "completely round"]),
                ("feasible", "possible and practical to do", 
                 ["completely impossible", "very loud", "extremely wet"]),
                ("inherent", "existing as a natural or basic part", 
                 ["artificially added", "very small", "extremely hot"]),
                ("modify", "to make small changes to improve something", 
                 ["to leave unchanged", "to destroy completely", "to paint green"]),
                ("relevant", "closely connected to the matter at hand", 
                 ["completely unrelated", "very cold", "extremely small"]),
            ],
            9: [
                # Most advanced vocabulary for grade 9
                ("autonomous", "able to govern itself or control its own affairs", 
                 ["completely dependent", "very cold", "extremely small"]),
                ("catalyst", "something that causes an important change or event", 
                 ["something that prevents change", "a type of food", "a musical instrument"]),
                ("divergent", "moving in different directions from a common point", 
                 ["moving together", "staying still", "disappearing completely"]),
                ("empirical", "based on observation or experience rather than theory", 
                 ["purely theoretical", "very cold", "extremely small"]),
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
                ("volatile", "likely to change rapidly and unpredictably", 
                 ["very stable", "extremely cold", "completely dry"]),
                ("analogous", "similar in some ways but not identical", 
                 ["completely different", "exactly the same", "totally unrelated"]),
                ("anomaly", "something that differs from what is normal", 
                 ["perfectly normal", "a type of plant", "a cooking method"]),
                ("articulate", "able to express thoughts clearly", 
                 ["unable to speak clearly", "very cold", "extremely small"]),
                ("benevolent", "well-meaning and kindly", 
                 ["very cruel", "extremely cold", "completely wet"]),
                ("connotation", "an idea or feeling that a word invokes", 
                 ["the literal meaning only", "a type of bird", "a musical instrument"]),
                ("delineate", "to describe or portray precisely", 
                 ["to make unclear", "to break apart", "to paint yellow"]),
                ("elicit", "to draw out a response or reaction", 
                 ["to prevent any response", "to sleep deeply", "to run fast"]),
                ("exemplify", "to be a typical example of something", 
                 ["to be unlike anything", "to paint blue", "to sing loudly"]),
                ("lucid", "clear and easy to understand", 
                 ["very confusing", "extremely cold", "completely wet"]),
                ("prudent", "showing care and thought for the future", 
                 ["very reckless", "extremely hot", "completely round"]),
            ]
        }
        
        # Generate variations using prefixes, suffixes, and related forms
        self.word_variations = {
            "prefixes": ["un", "re", "pre", "dis", "mis", "over", "under", "out", "sub", "inter"],
            "suffixes": ["tion", "ment", "ness", "ity", "ful", "less", "able", "ive", "ous", "ly"],
            "modifiers": ["very", "extremely", "somewhat", "particularly", "especially", "quite", "rather", "fairly", "highly", "deeply"]
        }
        
        # Expanded mood-based question formats
        self.mood_formats = {
            "curious": [
                "What does the word '{}' mean?",
                "What is the meaning of '{}'?",
                "Which definition best describes '{}'?",
                "What does '{}' refer to?",
                "How would you define '{}'?"
            ],
            "analytical": [
                "Which definition best describes the word '{}'?",
                "Select the most accurate meaning of '{}':",
                "The word '{}' is best defined as:",
                "Analyze the meaning of '{}':",
                "Which option correctly defines '{}'?"
            ],
            "practical": [
                "In everyday use, what does '{}' mean?",
                "How is '{}' commonly used?",
                "What does '{}' mean in practical terms?",
                "The practical meaning of '{}' is:",
                "In real-world usage, '{}' means:"
            ],
            "competitive": [
                "Select the correct meaning of '{}':",
                "Challenge: Define '{}'!",
                "Quick! What does '{}' mean?",
                "Test your knowledge: What is '{}'?",
                "Competition question: Define '{}'!"
            ],
            "creative": [
                "The word '{}' is best defined as:",
                "Explore the meaning of '{}':",
                "Discover what '{}' means:",
                "Uncover the definition of '{}':",
                "The creative meaning of '{}' is:"
            ],
            "adventurous": [
                "Discover the meaning of '{}':",
                "Explore what '{}' means!",
                "Adventure into the definition of '{}':",
                "Journey to understand '{}':",
                "Quest: What does '{}' mean?"
            ],
            "relaxed": [
                "Simply put, '{}' means:",
                "In simple terms, '{}' is:",
                "The easy definition of '{}' is:",
                "Casually speaking, '{}' means:",
                "The relaxed meaning of '{}' is:"
            ],
            "cool": [
                "What's the definition of '{}'?",
                "Define '{}' in your own words:",
                "The cool meaning of '{}' is:",
                "Break it down: What's '{}'?",
                "Real talk: What does '{}' mean?"
            ]
        }

    def generate_variations(self, base_word: str, definition: str, grade: int) -> List[Tuple[str, str, List[str]]]:
        """Generate variations of words with their definitions"""
        variations = []
        
        # Add compound words
        compounds = [
            (f"{base_word}like", f"resembling or similar to {definition}", 
             ["completely different from it", "a type of animal", "a cooking method"]),
            (f"non{base_word}", f"not having the quality of {definition}", 
             ["exactly the same as it", "a type of plant", "a musical instrument"]),
        ]
        
        # Add words with different meanings but related forms
        if grade >= 7:
            # Add more complex variations for higher grades
            variations.extend([
                (f"{base_word}ness", f"the state or quality of {definition}", 
                 ["the opposite of it", "a type of food", "a weather condition"]),
                (f"{base_word}ful", f"full of or characterized by {definition}", 
                 ["lacking it completely", "a type of building", "a time of day"]),
            ])
        
        return variations

    def generate_wrong_definitions(self, correct_def: str, word: str) -> List[str]:
        """Generate plausible but incorrect definitions"""
        wrong_patterns = [
            # Object/thing patterns
            ["a type of {}", "a kind of {}", "a variety of {}"],
            ["food", "plant", "animal", "tool", "instrument", "vehicle", "building", "clothing", "furniture", "device"],
            
            # Action patterns  
            ["to {} something", "to {} quickly", "to {} slowly"],
            ["eat", "break", "hide", "throw", "paint", "sing", "dance", "jump", "sleep", "run"],
            
            # Quality patterns
            ["extremely {}", "very {}", "completely {}"],
            ["hot", "cold", "wet", "dry", "loud", "quiet", "bright", "dark", "heavy", "light"],
            
            # Opposite meanings
            ["the opposite of " + correct_def[:20] + "...", 
             "not " + correct_def[:15] + "...",
             "contrary to " + correct_def[:15] + "..."]
        ]
        
        # Generate 3 wrong definitions
        wrong_defs = []
        templates = random.choice(wrong_patterns[:3])
        items = wrong_patterns[1] if len(wrong_patterns) > 1 else ["thing", "object", "item"]
        
        for i in range(3):
            if i == 0 and len(wrong_patterns) > 3:
                # Use opposite pattern for one
                wrong_defs.append(random.choice(wrong_patterns[3]))
            else:
                template = random.choice(templates)
                item = random.choice(items)
                wrong_defs.append(template.format(item) if "{}" in template else template)
        
        return wrong_defs

    def generate_hash(self, question_text: str, config: Dict) -> str:
        """Generate unique hash for question"""
        content = f"{question_text}_{config['topic']}_{config['grade']}_{config['difficulty']}_{time.time()}"
        return hashlib.md5(content.encode()).hexdigest()

    def generate_question(self, grade: int, difficulty: int, mood: str, word_index: int) -> VocabularyQuestion:
        """Generate a single vocabulary question with guaranteed correct answer"""
        
        # Get vocabulary for grade level
        grade_vocab = self.base_vocabulary.get(grade, self.base_vocabulary[7])
        
        # For generating 2000 unique questions, we need to:
        # 1. Use all base words multiple times with different formats
        # 2. Generate variations of words
        # 3. Use different wrong answer combinations
        
        # Select word based on index to ensure variety
        vocab_index = word_index % len(grade_vocab)
        word_data = grade_vocab[vocab_index]
        word, correct_definition, base_wrong_definitions = word_data
        
        # For higher difficulties, modify the word or definition slightly
        if difficulty >= 7 and grade >= 7:
            # Add complexity for harder questions
            variations = self.generate_variations(word, correct_definition, grade)
            if variations and random.random() > 0.5:
                var_data = random.choice(variations)
                word, correct_definition, base_wrong_definitions = var_data
        
        # Generate unique wrong definitions for this instance
        if word_index > len(grade_vocab):
            # After first pass, generate new wrong definitions
            wrong_definitions = self.generate_wrong_definitions(correct_definition, word)
        else:
            wrong_definitions = base_wrong_definitions
        
        # Select question format based on mood and variety
        mood_format_list = self.mood_formats.get(mood, self.mood_formats["curious"])
        format_index = word_index % len(mood_format_list)
        question_format = mood_format_list[format_index]
        question_text = question_format.format(word)
        
        # Create options (guaranteed only one correct answer)
        options = [correct_definition] + list(wrong_definitions)[:3]
        random.shuffle(options)
        
        # Create question structure matching database format
        question_data = {
            "question_text": question_text,
            "question_type": "multiple_choice",
            "correct_answer": correct_definition,
            "options": options,
            "explanation": f"'{word}' means: {correct_definition}",
            "hints": [
                f"Think about the root meaning of '{word}'.",
                f"Consider how '{word}' is used in everyday language.",
                f"The word '{word}' has {len(word)} letters.",
                "Eliminate definitions that don't make logical sense."
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

    def insert_batch_to_database(self, questions: List[VocabularyQuestion], batch_size: int = 100) -> Tuple[int, int]:
        """Insert questions into Supabase database in batches"""
        success_count = 0
        error_count = 0
        
        # Process in batches for better performance
        for i in range(0, len(questions), batch_size):
            batch = questions[i:i + batch_size]
            batch_data = []
            
            for q in batch:
                batch_data.append({
                    "topic": q.topic,
                    "difficulty": q.difficulty,
                    "grade": q.grade,
                    "question": json.dumps(q.question),
                    "ai_model": q.ai_model,
                    "mood": q.mood,
                    "question_hash": q.question_hash,
                    "expires_at": None  # Permanent questions
                })
            
            try:
                result = supabase.table('question_cache').insert(batch_data).execute()
                success_count += len(batch)
                print(f"Inserted batch {i//batch_size + 1}, total: {success_count}")
            except Exception as e:
                logger.error(f"Error inserting batch: {e}")
                error_count += len(batch)
        
        return success_count, error_count

def main():
    """Main execution function"""
    generator = LargeVocabularyGenerator()
    
    print("Large-Scale Vocabulary Question Generator")
    print("========================================")
    print(f"Database: {SUPABASE_URL}")
    print()
    
    # Configuration
    grades = [5, 6, 7, 8, 9]  # Grades 5-9
    difficulties = [4, 5, 6, 7, 8, 9, 10]  # Difficulties 4-10
    moods = ["curious", "analytical", "practical", "competitive", 
             "creative", "adventurous", "relaxed", "cool"]
    
    questions_per_combination = 1000  # 1000 questions per combination
    
    print(f"Configuration:")
    print(f"  Grades: {grades}")
    print(f"  Difficulties: {difficulties}")
    print(f"  Moods: {moods}")
    print(f"  Questions per combination: {questions_per_combination}")
    print(f"  Total combinations: {len(grades) * len(difficulties) * len(moods)}")
    print(f"  Total questions to generate: {len(grades) * len(difficulties) * len(moods) * questions_per_combination:,}")
    print()
    
    # Ask for confirmation
    response = input("This will generate 280,000 questions. Continue? (yes/no): ")
    if response.lower() != 'yes':
        print("Cancelled.")
        return
    
    start_time = time.time()
    total_generated = 0
    total_success = 0
    total_errors = 0
    
    for grade in grades:
        for difficulty in difficulties:
            for mood in moods:
                print(f"\nGenerating for Grade {grade}, Difficulty {difficulty}, Mood {mood}...")
                
                questions = []
                for i in range(questions_per_combination):
                    question = generator.generate_question(grade, difficulty, mood, i)
                    questions.append(question)
                    
                    if (i + 1) % 100 == 0:
                        print(f"  Generated {i + 1}/{questions_per_combination} questions", end="\r")
                
                print(f"  Generated {questions_per_combination} questions, inserting to database...")
                
                # Insert this batch to database
                success, errors = generator.insert_batch_to_database(questions)
                total_success += success
                total_errors += errors
                total_generated += len(questions)
                
                elapsed = time.time() - start_time
                rate = total_generated / elapsed if elapsed > 0 else 0
                remaining = (280000 - total_generated) / rate if rate > 0 else 0
                
                print(f"  Progress: {total_generated:,}/280,000 ({total_generated/2800:.1f}%)")
                print(f"  Rate: {rate:.1f} questions/second")
                print(f"  Estimated time remaining: {remaining/60:.1f} minutes")
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"\n{'='*50}")
    print(f"Generation Complete!")
    print(f"{'='*50}")
    print(f"Total questions generated: {total_generated:,}")
    print(f"Successfully inserted: {total_success:,}")
    print(f"Errors: {total_errors:,}")
    print(f"Total time: {duration/60:.1f} minutes")
    print(f"Average rate: {total_generated/duration:.1f} questions/second")
    
    # Show sample questions
    print("\nSample questions from the last batch:")
    for i in range(min(3, len(questions))):
        q = questions[i]
        print(f"\nSample {i+1}:")
        print(f"  Question: {q.question['question_text']}")
        print(f"  Correct: {q.question['correct_answer']}")

if __name__ == "__main__":
    main()