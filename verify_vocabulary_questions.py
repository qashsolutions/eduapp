#!/usr/bin/env python3
"""
Verify and Fix Vocabulary Questions in Database
This script checks existing vocabulary questions for issues and can fix them
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any, Tuple
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

class VocabularyVerifier:
    """Verify and fix vocabulary questions"""
    
    def fetch_vocabulary_questions(self, limit: int = 1000) -> List[Dict]:
        """Fetch vocabulary questions from database"""
        try:
            result = supabase.table('question_cache') \
                .select('*') \
                .eq('topic', 'english_vocabulary') \
                .is_('expires_at', 'null') \
                .limit(limit) \
                .execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Error fetching questions: {e}")
            return []
    
    def verify_question(self, question_record: Dict) -> Tuple[bool, List[str]]:
        """Verify a single question for correctness"""
        issues = []
        
        try:
            question_data = question_record.get('question')
            if isinstance(question_data, str):
                question_data = json.loads(question_data)
            
            # Check required fields
            required_fields = ['question_text', 'options', 'correct_answer']
            for field in required_fields:
                if field not in question_data:
                    issues.append(f"Missing required field: {field}")
            
            if not issues:
                # Check if correct answer is in options
                correct_answer = question_data.get('correct_answer')
                options = question_data.get('options', [])
                
                if isinstance(options, dict):
                    # Handle dict format (A, B, C, D)
                    option_values = list(options.values())
                else:
                    # Handle list format
                    option_values = options
                
                if correct_answer not in option_values:
                    issues.append(f"Correct answer '{correct_answer}' not found in options")
                
                # Check for duplicate options
                if len(option_values) != len(set(option_values)):
                    issues.append("Duplicate options found")
                
                # Check for empty options
                if any(not opt.strip() for opt in option_values):
                    issues.append("Empty option found")
                
                # Check if options make sense (all should be definitions/meanings)
                if len(option_values) < 4:
                    issues.append(f"Too few options: {len(option_values)}")
            
        except Exception as e:
            issues.append(f"Error parsing question: {str(e)}")
        
        return len(issues) == 0, issues
    
    def analyze_all_questions(self) -> Dict[str, Any]:
        """Analyze all vocabulary questions"""
        questions = self.fetch_vocabulary_questions()
        
        logger.info(f"Fetched {len(questions)} vocabulary questions")
        
        stats = {
            'total': len(questions),
            'valid': 0,
            'invalid': 0,
            'issues_by_type': {},
            'invalid_questions': []
        }
        
        for q in questions:
            is_valid, issues = self.verify_question(q)
            
            if is_valid:
                stats['valid'] += 1
            else:
                stats['invalid'] += 1
                stats['invalid_questions'].append({
                    'id': q['id'],
                    'grade': q['grade'],
                    'difficulty': q['difficulty'],
                    'issues': issues
                })
                
                # Count issues by type
                for issue in issues:
                    issue_type = issue.split(':')[0]
                    stats['issues_by_type'][issue_type] = stats['issues_by_type'].get(issue_type, 0) + 1
        
        return stats
    
    def delete_invalid_questions(self, invalid_ids: List[str]) -> int:
        """Delete invalid questions from database"""
        deleted = 0
        
        for q_id in invalid_ids:
            try:
                result = supabase.table('question_cache') \
                    .delete() \
                    .eq('id', q_id) \
                    .execute()
                deleted += 1
            except Exception as e:
                logger.error(f"Error deleting question {q_id}: {e}")
        
        return deleted

def main():
    """Main execution function"""
    verifier = VocabularyVerifier()
    
    print("Vocabulary Question Verifier")
    print("===========================")
    print(f"Database: {SUPABASE_URL}")
    print()
    
    print("Analyzing existing vocabulary questions...")
    stats = verifier.analyze_all_questions()
    
    print(f"\nAnalysis Results:")
    print(f"Total questions: {stats['total']}")
    print(f"Valid questions: {stats['valid']} ({stats['valid']/stats['total']*100:.1f}%)")
    print(f"Invalid questions: {stats['invalid']} ({stats['invalid']/stats['total']*100:.1f}%)")
    
    if stats['issues_by_type']:
        print(f"\nIssues found:")
        for issue_type, count in stats['issues_by_type'].items():
            print(f"  {issue_type}: {count}")
    
    if stats['invalid_questions']:
        print(f"\nSample invalid questions (first 5):")
        for i, q in enumerate(stats['invalid_questions'][:5]):
            print(f"\n  Question {i+1} (ID: {q['id']}):")
            print(f"    Grade: {q['grade']}, Difficulty: {q['difficulty']}")
            print(f"    Issues: {', '.join(q['issues'])}")
        
        # Ask user if they want to delete invalid questions
        print(f"\nFound {len(stats['invalid_questions'])} invalid questions.")
        response = input("Do you want to delete these invalid questions? (yes/no): ")
        
        if response.lower() == 'yes':
            invalid_ids = [q['id'] for q in stats['invalid_questions']]
            deleted = verifier.delete_invalid_questions(invalid_ids)
            print(f"Deleted {deleted} invalid questions.")
        else:
            print("No questions deleted.")
            
            # Save invalid question IDs to file for review
            with open('invalid_vocabulary_questions.json', 'w') as f:
                json.dump(stats['invalid_questions'], f, indent=2)
            print("Invalid question details saved to 'invalid_vocabulary_questions.json'")
    else:
        print("\nAll vocabulary questions are valid!")

if __name__ == "__main__":
    main()