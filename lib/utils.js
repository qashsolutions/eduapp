// Core utilities and educational topics database
export const EDUCATIONAL_TOPICS = {
  english_comprehension: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    subtopics: [
      'narrative-fiction', 'historical-texts', 'science-articles', 'mystery-detective',
      'biography-memoir', 'news-current-events', 'how-to-instructional', 
      'nature-environment', 'technology-innovation', 'social-studies',
      'us-history', 'world-history', 'world-war-i', 'world-war-ii', 
      'ancient-civilizations', 'us-constitution', 'world-cultures-geography',
      'rivers-dams', 'mountain-ranges', 'sports-rugby', 'sports-baseball',
      'sports-cricket', 'sports-soccer', 'sports-football', 'sports-basketball',
      'sports-nba', 'sports-nfl'
    ],
    contexts: [
      'adventure', 'school-life', 'fantasy', 'real-world',
      'scientific-discovery', 'historical-events', 'daily-life',
      'educational-setting', 'workplace', 'community',
      'battlefield-wartime', 'ancient-world', 'modern-era',
      'constitutional-convention', 'global-cultures', 'natural-landmarks',
      'sports-stadium', 'professional-athletics', 'olympic-games',
      'geographic-exploration', 'cultural-traditions'
    ],
    socraticPrompts: {
      easy: "What is the main character doing in this passage?",
      medium: "Why do you think the character made this choice?",
      hard: "How does this theme connect to real life?"
    },
  },
  english_grammar: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    subtopics: ['parts-of-speech', 'sentence-structure', 'punctuation', 'verb-tenses'],
    contexts: ['everyday-conversation', 'formal-writing', 'creative-writing'],
    socraticPrompts: {
      easy: "Can you identify the verb in this sentence?",
      medium: "What would happen if we changed the tense here?",
      hard: "How does grammar affect the meaning of this text?"
    },
  },
  english_vocabulary: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    subtopics: ['word-meanings', 'context-clues', 'word-roots', 'idioms'],
    contexts: ['academic', 'everyday', 'literature', 'technical'],
    socraticPrompts: {
      easy: "What might this word mean based on the sentence?",
      medium: "Can you think of another word that means the same thing?",
      hard: "How does this word choice affect the tone?"
    },
  },
  english_sentences: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    subtopics: ['simple-sentences', 'compound-sentences', 'complex-sentences', 'paragraph-building'],
    contexts: ['storytelling', 'persuasive', 'descriptive', 'informative'],
    socraticPrompts: {
      easy: "What makes this a complete sentence?",
      medium: "How could we combine these two ideas?",
      hard: "What effect does this sentence structure create?"
    },
  },
  english_synonyms: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    subtopics: ['basic-synonyms', 'nuanced-meanings', 'formal-informal', 'regional-variations'],
    contexts: ['writing', 'speaking', 'reading-comprehension'],
    socraticPrompts: {
      easy: "Which word has a similar meaning?",
      medium: "How are these synonyms slightly different?",
      hard: "When would you use one synonym over another?"
    },
  },
  english_antonyms: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    subtopics: ['direct-opposites', 'gradual-opposites', 'contextual-opposites'],
    contexts: ['vocabulary-building', 'comprehension', 'creative-writing'],
    socraticPrompts: {
      easy: "What's the opposite of this word?",
      medium: "Are there different levels of opposition here?",
      hard: "How do antonyms help express contrast in writing?"
    },
  },
  english_fill_blanks: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    subtopics: ['vocabulary-completion', 'grammar-completion', 'context-completion'],
    contexts: ['stories', 'factual-texts', 'dialogues', 'instructions'],
    socraticPrompts: {
      easy: "What type of word fits here?",
      medium: "What clues help you choose the right word?",
      hard: "How does your choice affect the overall meaning?"
    },
  }
};


// ISEE Syllabus Mapping
export const ISEE_SYLLABUS_MAP = {
  // Lower Level (Grades 5-6)
  5: {
    english_vocabulary: {
      standards: ['Grade-level vocabulary', 'Word relationships', 'Subtle meaning differences'],
      focus: 'Synonyms and vocabulary in context',
      questionTypes: ['Select closest meaning', 'Context-based vocabulary']
    },
    english_sentences: {
      standards: ['Context clues', 'Vocabulary in context', 'Logical sentence structure', 'Syntactic and semantic cues'],
      focus: 'Sentence completion with single words or phrases',
      questionTypes: ['Complete sentences', 'Fill in blanks']
    },
    english_comprehension: {
      standards: ['Main idea', 'Supporting details', 'Inference', 'Vocabulary in context'],
      focus: 'Reading comprehension of 300-600 word passages',
      questionTypes: ['Main idea', 'Supporting ideas', 'Inference', 'Vocabulary']
    }
  },
  6: {
    // Same as grade 5 for Lower Level ISEE
    english_vocabulary: {
      standards: ['Grade-level vocabulary', 'Word relationships', 'Subtle meaning differences'],
      focus: 'Synonyms and vocabulary in context',
      questionTypes: ['Select closest meaning', 'Context-based vocabulary']
    },
    english_sentences: {
      standards: ['Context clues', 'Vocabulary in context', 'Logical sentence structure', 'Syntactic and semantic cues'],
      focus: 'Sentence completion with single words or phrases',
      questionTypes: ['Complete sentences', 'Fill in blanks']
    },
    english_comprehension: {
      standards: ['Main idea', 'Supporting details', 'Inference', 'Vocabulary in context'],
      focus: 'Reading comprehension of 300-600 word passages',
      questionTypes: ['Main idea', 'Supporting ideas', 'Inference', 'Vocabulary']
    }
  },
  // Middle Level (Grades 7-8)
  7: {
    english_vocabulary: {
      standards: ['Middle/high school vocabulary', 'Abstract concepts', 'Word relationships'],
      focus: 'Advanced synonyms and vocabulary',
      questionTypes: ['Select closest meaning', 'Abstract vocabulary']
    },
    english_sentences: {
      standards: ['Complex vocabulary in context', 'Advanced sentence structure', 'Syntactic cues'],
      focus: 'Advanced sentence completion',
      questionTypes: ['Complete complex sentences', 'Advanced fill-in-blanks']
    },
    english_comprehension: {
      standards: ['Main idea', 'Supporting details', 'Advanced inference', 'Literary analysis'],
      focus: 'Reading comprehension of ~450 word passages',
      questionTypes: ['Main idea', 'Inference', 'Tone/style', 'Organization']
    }
  },
  8: {
    // Same as grade 7 for Middle Level ISEE
    english_vocabulary: {
      standards: ['Middle/high school vocabulary', 'Abstract concepts', 'Word relationships'],
      focus: 'Advanced synonyms and vocabulary',
      questionTypes: ['Select closest meaning', 'Abstract vocabulary']
    },
    english_sentences: {
      standards: ['Complex vocabulary in context', 'Advanced sentence structure', 'Syntactic cues'],
      focus: 'Advanced sentence completion',
      questionTypes: ['Complete complex sentences', 'Advanced fill-in-blanks']
    },
    english_comprehension: {
      standards: ['Main idea', 'Supporting details', 'Advanced inference', 'Literary analysis'],
      focus: 'Reading comprehension of ~450 word passages',
      questionTypes: ['Main idea', 'Inference', 'Tone/style', 'Organization']
    }
  }
};

// Function to get ISEE standard for a grade and topic
export const getISEEStandard = (grade, topic) => {
  // Default to grade 6 or 8 if grade is outside range
  const mappedGrade = grade <= 6 ? Math.max(5, Math.min(6, grade)) : Math.max(7, Math.min(8, grade));
  return ISEE_SYLLABUS_MAP[mappedGrade]?.[topic] || null;
};


// Proficiency update logic
export const updateProficiency = (current, correct) => {
  const change = correct ? 0.2 : -0.1;
  return Math.max(1, Math.min(9, current + change));
};

// Map proficiency to difficulty
export const mapProficiencyToDifficulty = (proficiency, complexityLevels) => {
  const maxLevel = Math.max(...complexityLevels);
  const level = Math.ceil((proficiency / 9) * maxLevel);
  return Math.min(level, maxLevel);
};

// Local storage helpers with 7-day expiry
export const getCachedProficiency = (topic) => {
  if (typeof window === 'undefined') return null;
  
  const cached = localStorage.getItem(`proficiency_${topic}`);
  if (!cached) return null;
  
  const { value, timestamp } = JSON.parse(cached);
  const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
  
  if (Date.now() - timestamp > sevenDaysInMs) {
    localStorage.removeItem(`proficiency_${topic}`);
    return null;
  }
  
  return value;
};

export const setCachedProficiency = (topic, value) => {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(`proficiency_${topic}`, JSON.stringify({
    value,
    timestamp: Date.now()
  }));
};

// Format topic name for display
export const formatTopicName = (topic) => {
  return topic
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Get random context for variety
export const getRandomContext = (contexts) => {
  return contexts[Math.floor(Math.random() * contexts.length)];
};

// Get appropriate Socratic prompt
export const getSocraticPrompt = (topic, difficulty) => {
  const prompts = EDUCATIONAL_TOPICS[topic]?.socraticPrompts;
  if (!prompts) return "Let's think about this step by step...";
  
  if (difficulty <= 2) return prompts.easy;
  if (difficulty <= 4) return prompts.medium;
  return prompts.hard;
};

// Generate hash for question uniqueness
export const generateQuestionHash = (topic, subtopic, context, difficulty, questionText) => {
  // Simple hash using key elements
  const hashString = `${topic}-${subtopic}-${context}-${difficulty}-${questionText.substring(0, 50)}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < hashString.length; i++) {
    const char = hashString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return `${topic}_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
};