#!/usr/bin/env python3
"""
Check current status of vocabulary questions in the database
"""

import json
import os
from dotenv import load_dotenv
from supabase import create_client, Client
from collections import defaultdict

# Load environment variables
load_dotenv('.env.local')
load_dotenv('.env', override=False)

# Supabase configuration
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Missing Supabase credentials. Please check .env.local or .env files")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_vocabulary_questions():
    """Check the current state of vocabulary questions"""
    
    print("Vocabulary Questions Status Check")
    print("=================================")
    print(f"Database: {SUPABASE_URL}")
    print()
    
    try:
        # Get total count
        count_result = supabase.table('question_cache') \
            .select('*', count='exact') \
            .eq('topic', 'english_vocabulary') \
            .is_('expires_at', 'null') \
            .execute()
        
        total_count = count_result.count if hasattr(count_result, 'count') else len(count_result.data)
        print(f"Total vocabulary questions: {total_count}")
        
        # Get breakdown by grade
        print("\nQuestions by grade:")
        for grade in range(5, 12):
            grade_result = supabase.table('question_cache') \
                .select('*', count='exact') \
                .eq('topic', 'english_vocabulary') \
                .eq('grade', grade) \
                .is_('expires_at', 'null') \
                .execute()
            
            grade_count = grade_result.count if hasattr(grade_result, 'count') else len(grade_result.data)
            print(f"  Grade {grade}: {grade_count}")
        
        # Get breakdown by difficulty
        print("\nQuestions by difficulty:")
        for diff in range(1, 10):
            diff_result = supabase.table('question_cache') \
                .select('*', count='exact') \
                .eq('topic', 'english_vocabulary') \
                .eq('difficulty', diff) \
                .is_('expires_at', 'null') \
                .execute()
            
            diff_count = diff_result.count if hasattr(diff_result, 'count') else len(diff_result.data)
            print(f"  Difficulty {diff}: {diff_count}")
        
        # Get sample questions
        print("\nSample vocabulary questions:")
        samples = supabase.table('question_cache') \
            .select('*') \
            .eq('topic', 'english_vocabulary') \
            .is_('expires_at', 'null') \
            .limit(3) \
            .execute()
        
        for i, q in enumerate(samples.data):
            print(f"\nSample {i+1}:")
            print(f"  Grade: {q['grade']}, Difficulty: {q['difficulty']}")
            
            question_data = q['question']
            if isinstance(question_data, str):
                question_data = json.loads(question_data)
            
            print(f"  Question: {question_data.get('question_text', 'N/A')}")
            
            # Handle different option formats
            options = question_data.get('options', [])
            if isinstance(options, dict):
                print(f"  Options: {list(options.values())}")
            else:
                print(f"  Options: {options}")
            
            print(f"  Correct: {question_data.get('correct_answer', 'N/A')}")
        
    except Exception as e:
        print(f"Error checking questions: {e}")

if __name__ == "__main__":
    check_vocabulary_questions()