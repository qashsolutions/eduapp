// Core utilities and educational topics database
export const EDUCATIONAL_TOPICS = {
  english_comprehension: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    aiModel: 'openai',
    subtopics: ['narrative-fiction', 'historical-texts', 'science-articles', 'mystery-detective'],
    contexts: ['adventure', 'school-life', 'fantasy', 'real-world'],
    socraticPrompts: {
      easy: "What is the main character doing in this passage?",
      medium: "Why do you think the character made this choice?",
      hard: "How does this theme connect to real life?"
    },
    moods: ['creative', 'relaxed', 'curious', 'adventurous']
  },
  english_grammar: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    aiModel: 'openai',
    subtopics: ['parts-of-speech', 'sentence-structure', 'punctuation', 'verb-tenses'],
    contexts: ['everyday-conversation', 'formal-writing', 'creative-writing'],
    socraticPrompts: {
      easy: "Can you identify the verb in this sentence?",
      medium: "What would happen if we changed the tense here?",
      hard: "How does grammar affect the meaning of this text?"
    },
    moods: ['analytical', 'practical', 'competitive']
  },
  english_vocabulary: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    aiModel: 'claude',
    subtopics: ['word-meanings', 'context-clues', 'word-roots', 'idioms'],
    contexts: ['academic', 'everyday', 'literature', 'technical'],
    socraticPrompts: {
      easy: "What might this word mean based on the sentence?",
      medium: "Can you think of another word that means the same thing?",
      hard: "How does this word choice affect the tone?"
    },
    moods: ['curious', 'analytical', 'creative']
  },
  english_sentences: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    aiModel: 'openai',
    subtopics: ['simple-sentences', 'compound-sentences', 'complex-sentences', 'paragraph-building'],
    contexts: ['storytelling', 'persuasive', 'descriptive', 'informative'],
    socraticPrompts: {
      easy: "What makes this a complete sentence?",
      medium: "How could we combine these two ideas?",
      hard: "What effect does this sentence structure create?"
    },
    moods: ['creative', 'practical', 'analytical']
  },
  english_synonyms: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    aiModel: 'claude',
    subtopics: ['basic-synonyms', 'nuanced-meanings', 'formal-informal', 'regional-variations'],
    contexts: ['writing', 'speaking', 'reading-comprehension'],
    socraticPrompts: {
      easy: "Which word has a similar meaning?",
      medium: "How are these synonyms slightly different?",
      hard: "When would you use one synonym over another?"
    },
    moods: ['analytical', 'curious', 'creative']
  },
  english_antonyms: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    aiModel: 'claude',
    subtopics: ['direct-opposites', 'gradual-opposites', 'contextual-opposites'],
    contexts: ['vocabulary-building', 'comprehension', 'creative-writing'],
    socraticPrompts: {
      easy: "What's the opposite of this word?",
      medium: "Are there different levels of opposition here?",
      hard: "How do antonyms help express contrast in writing?"
    },
    moods: ['analytical', 'competitive', 'curious']
  },
  english_fill_blanks: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5],
    aiModel: 'openai',
    subtopics: ['vocabulary-completion', 'grammar-completion', 'context-completion'],
    contexts: ['stories', 'factual-texts', 'dialogues', 'instructions'],
    socraticPrompts: {
      easy: "What type of word fits here?",
      medium: "What clues help you choose the right word?",
      hard: "How does your choice affect the overall meaning?"
    },
    moods: ['practical', 'analytical', 'competitive']
  },
  math_number_theory: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5, 6],
    aiModel: 'openai',
    subtopics: ['prime-numbers', 'factors-multiples', 'divisibility', 'patterns'],
    contexts: ['puzzles', 'real-world-problems', 'games', 'coding'],
    socraticPrompts: {
      easy: "What do you notice about these numbers?",
      medium: "Can you find a pattern here?",
      hard: "Why does this mathematical property work?"
    },
    moods: ['analytical', 'curious', 'competitive']
  },
  math_algebra: {
    gradeRange: '6-11',
    complexityLevels: [1, 2, 3, 4, 5, 6],
    aiModel: 'openai',
    subtopics: ['linear-equations', 'quadratic-equations', 'systems', 'inequalities'],
    contexts: ['shopping', 'sports', 'science', 'finance'],
    socraticPrompts: {
      easy: "What does the variable represent?",
      medium: "What operation would isolate the variable?",
      hard: "How can we verify our solution?"
    },
    moods: ['analytical', 'practical', 'competitive']
  },
  math_geometry: {
    gradeRange: '5-11',
    complexityLevels: [1, 2, 3, 4, 5, 6],
    aiModel: 'openai',
    subtopics: ['shapes', 'angles', 'area-perimeter', 'transformations'],
    contexts: ['architecture', 'art', 'nature', 'engineering'],
    socraticPrompts: {
      easy: "What shape do you see?",
      medium: "How can we find the missing measurement?",
      hard: "What geometric principle applies here?"
    },
    moods: ['creative', 'practical', 'analytical']
  },
  math_statistics: {
    gradeRange: '7-11',
    complexityLevels: [1, 2, 3, 4, 5, 6],
    aiModel: 'claude',
    subtopics: ['mean-median-mode', 'probability', 'data-interpretation', 'distributions'],
    contexts: ['sports-stats', 'weather', 'surveys', 'games'],
    socraticPrompts: {
      easy: "What does this data tell us?",
      medium: "What's the likelihood of this event?",
      hard: "What conclusions can we draw from this data?"
    },
    moods: ['analytical', 'practical', 'curious']
  },
  math_precalculus: {
    gradeRange: '9-11',
    complexityLevels: [1, 2, 3, 4, 5, 6, 7],
    aiModel: 'claude',
    subtopics: ['functions', 'trigonometry', 'sequences-series', 'complex-numbers'],
    contexts: ['physics', 'engineering', 'computer-graphics', 'music'],
    socraticPrompts: {
      easy: "What type of function is this?",
      medium: "How does changing this parameter affect the graph?",
      hard: "What real-world phenomenon does this model?"
    },
    moods: ['analytical', 'adventurous', 'competitive']
  },
  math_calculus: {
    gradeRange: '10-11',
    complexityLevels: [1, 2, 3, 4, 5, 6, 7, 8],
    aiModel: 'claude',
    subtopics: ['limits', 'derivatives', 'integrals', 'applications'],
    contexts: ['physics-motion', 'optimization', 'economics', 'biology'],
    socraticPrompts: {
      easy: "What is the rate of change here?",
      medium: "How can we find the maximum or minimum?",
      hard: "What does the integral represent in this context?"
    },
    moods: ['analytical', 'adventurous', 'competitive']
  }
};

// AI routing map
export const AI_ROUTING = {
  'english_comprehension': 'openai',
  'english_grammar': 'openai',
  'english_sentences': 'openai',
  'english_fill_blanks': 'openai',
  'math_number_theory': 'openai',
  'math_algebra': 'openai',
  'math_geometry': 'openai',
  'english_vocabulary': 'claude',
  'english_synonyms': 'claude',
  'english_antonyms': 'claude',
  'math_statistics': 'claude',
  'math_precalculus': 'claude',
  'math_calculus': 'claude'
};

// Mood to topics mapping
export const MOOD_TOPICS = {
  creative: ['english_comprehension', 'english_vocabulary', 'english_sentences', 'math_geometry'],
  analytical: ['english_grammar', 'english_synonyms', 'english_antonyms', 'math_number_theory', 'math_algebra', 'math_statistics', 'math_precalculus', 'math_calculus'],
  competitive: ['english_grammar', 'english_fill_blanks', 'math_number_theory', 'math_algebra', 'math_precalculus', 'math_calculus'],
  relaxed: ['english_comprehension'],
  curious: ['english_comprehension', 'english_vocabulary', 'english_synonyms', 'english_antonyms', 'math_number_theory', 'math_statistics'],
  social: ['english_comprehension', 'english_sentences'],
  adventurous: ['english_comprehension', 'math_precalculus', 'math_calculus'],
  practical: ['english_grammar', 'english_sentences', 'english_fill_blanks', 'math_algebra', 'math_geometry', 'math_statistics']
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
    },
    math_number_theory: {
      standards: ['Four operations', 'Place value', 'Number properties', 'Divisibility rules'],
      focus: 'Whole numbers and basic operations',
      questionTypes: ['Multi-step calculations', 'Word problems']
    },
    math_algebra: {
      standards: ['Pattern recognition', 'Simple equations', 'Variables and expressions'],
      focus: 'Basic algebraic thinking',
      questionTypes: ['Pre-algebra concepts', 'Pattern problems']
    },
    math_geometry: {
      standards: ['Basic shapes', 'Symmetry', 'Coordinate grids', 'Perimeter', 'Area'],
      focus: 'Spatial reasoning and measurement',
      questionTypes: ['Shape properties', 'Measurement problems']
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
    },
    math_number_theory: {
      standards: ['Four operations', 'Place value', 'Number properties', 'Divisibility rules'],
      focus: 'Whole numbers and basic operations',
      questionTypes: ['Multi-step calculations', 'Word problems']
    },
    math_algebra: {
      standards: ['Pattern recognition', 'Simple equations', 'Variables and expressions'],
      focus: 'Basic algebraic thinking',
      questionTypes: ['Pre-algebra concepts', 'Pattern problems']
    },
    math_geometry: {
      standards: ['Basic shapes', 'Symmetry', 'Coordinate grids', 'Perimeter', 'Area'],
      focus: 'Spatial reasoning and measurement',
      questionTypes: ['Shape properties', 'Measurement problems']
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
    },
    math_number_theory: {
      standards: ['Advanced operations', 'Fractions, decimals, percents', 'Estimation'],
      focus: 'Advanced number concepts',
      questionTypes: ['Logical reasoning', 'Word problems']
    },
    math_algebra: {
      standards: ['Linear equations', 'Functions', 'Variables and expressions', 'Pattern recognition'],
      focus: 'Pre-algebra to Algebra I',
      questionTypes: ['Algebraic thinking', 'Equation solving']
    },
    math_geometry: {
      standards: ['2D and 3D shapes', 'Coordinate geometry', 'Transformations', 'Similarity'],
      focus: 'Advanced geometry and spatial reasoning',
      questionTypes: ['Geometric proofs', 'Coordinate problems']
    },
    math_statistics: {
      standards: ['Data interpretation', 'Graphs and charts', 'Basic probability'],
      focus: 'Statistical literacy',
      questionTypes: ['Data analysis', 'Probability reasoning']
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
    },
    math_number_theory: {
      standards: ['Advanced operations', 'Fractions, decimals, percents', 'Estimation'],
      focus: 'Advanced number concepts',
      questionTypes: ['Logical reasoning', 'Word problems']
    },
    math_algebra: {
      standards: ['Linear equations', 'Functions', 'Variables and expressions', 'Pattern recognition'],
      focus: 'Pre-algebra to Algebra I',
      questionTypes: ['Algebraic thinking', 'Equation solving']
    },
    math_geometry: {
      standards: ['2D and 3D shapes', 'Coordinate geometry', 'Transformations', 'Similarity'],
      focus: 'Advanced geometry and spatial reasoning',
      questionTypes: ['Geometric proofs', 'Coordinate problems']
    },
    math_statistics: {
      standards: ['Data interpretation', 'Graphs and charts', 'Basic probability'],
      focus: 'Statistical literacy',
      questionTypes: ['Data analysis', 'Probability reasoning']
    }
  }
};

// Function to get ISEE standard for a grade and topic
export const getISEEStandard = (grade, topic) => {
  // Default to grade 6 or 8 if grade is outside range
  const mappedGrade = grade <= 6 ? Math.max(5, Math.min(6, grade)) : Math.max(7, Math.min(8, grade));
  return ISEE_SYLLABUS_MAP[mappedGrade]?.[topic] || null;
};

// Mood style instructions for question generation
export const getMoodStyle = (mood) => {
  const moodStyles = {
    creative: 'Present using stories, visual scenarios, or imaginative contexts',
    analytical: 'Focus on logical reasoning, step-by-step analysis, and systematic thinking',
    competitive: 'Add time pressure context, rankings, or challenge elements',
    relaxed: 'Use calming scenarios, everyday situations, no pressure',
    curious: 'Include interesting facts, "did you know" elements, exploratory themes',
    social: 'Use group scenarios, conversations, or collaborative contexts',
    adventurous: 'Include adventure themes, exploration, or discovery elements',
    practical: 'Focus on real-world applications and practical problem-solving'
  };
  return moodStyles[mood] || moodStyles.creative;
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