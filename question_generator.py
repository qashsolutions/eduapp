import json
import random
import hashlib
import os
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
from supabase import create_client, Client
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Subject(Enum):
    ENGLISH = "english"
    MATH = "math"

class Topic(Enum):
    # Math topics
    MATH_NUMBER_THEORY = "math_number_theory"
    MATH_ALGEBRA = "math_algebra"
    MATH_GEOMETRY = "math_geometry"
    MATH_STATISTICS = "math_statistics"
    MATH_PRECALCULUS = "math_precalculus"
    MATH_CALCULUS = "math_calculus"
    
    # English topics
    ENGLISH_GRAMMAR = "english_grammar"
    ENGLISH_VOCABULARY = "english_vocabulary"
    ENGLISH_SYNONYMS = "english_synonyms"
    ENGLISH_ANTONYMS = "english_antonyms"
    ENGLISH_SENTENCES = "english_sentences"
    ENGLISH_COMPREHENSION = "english_comprehension"

class Mood(Enum):
    CREATIVE = "creative"
    RELAXED = "relaxed"
    CURIOUS = "curious"
    ADVENTUROUS = "adventurous"
    ANALYTICAL = "analytical"
    PRACTICAL = "practical"
    COMPETITIVE = "competitive"
    COOL = "cool"

@dataclass
class QuestionConfig:
    topic: str
    grade: int
    difficulty: int  # 1-9 scale
    mood: str
    ai_model: str = "code_generated"

@dataclass
class GeneratedQuestion:
    question_text: str
    question_type: str
    correct_answer: str
    options: List[str]
    explanation: str
    hints: List[str]
    question_hash: str

class QuestionGenerator:
    def __init__(self):
        # Vocabulary banks by grade level (5-11)
        self.vocabulary_banks = {
            5: {
                "words": ["adventure", "mysterious", "courage", "challenge", "discover", "explore", "journey", "treasure", "ancient", "magical"],
                "synonyms": {
                    "big": ["large", "huge", "enormous"],
                    "happy": ["joyful", "cheerful", "glad"],
                    "fast": ["quick", "rapid", "swift"],
                    "smart": ["clever", "intelligent", "bright"],
                    "pretty": ["beautiful", "lovely", "attractive"]
                },
                "antonyms": {
                    "hot": "cold", "big": "small", "fast": "slow", "happy": "sad", "light": "dark",
                    "up": "down", "good": "bad", "old": "new", "long": "short", "high": "low"
                }
            },
            6: {
                "words": ["significant", "demonstrate", "analyze", "observe", "conclude", "evidence", "hypothesis", "remarkable", "elaborate", "comprehensive"],
                "synonyms": {
                    "important": ["significant", "crucial", "essential"],
                    "show": ["demonstrate", "display", "exhibit"],
                    "study": ["examine", "analyze", "investigate"],
                    "amazing": ["remarkable", "extraordinary", "incredible"],
                    "complete": ["thorough", "comprehensive", "entire"]
                },
                "antonyms": {
                    "simple": "complex", "beginning": "end", "increase": "decrease", "success": "failure", "strength": "weakness",
                    "clear": "unclear", "accept": "reject", "create": "destroy", "win": "lose", "include": "exclude"
                }
            },
            7: {
                "words": ["analyze", "synthesize", "evaluate", "perspective", "implications", "distinguish", "characterize", "subsequently", "furthermore", "nevertheless"],
                "synonyms": {
                    "examine": ["analyze", "investigate", "scrutinize"],
                    "combine": ["synthesize", "merge", "integrate"],
                    "assess": ["evaluate", "judge", "appraise"],
                    "viewpoint": ["perspective", "standpoint", "outlook"],
                    "separate": ["distinguish", "differentiate", "discriminate"]
                },
                "antonyms": {
                    "unity": "division", "clarity": "confusion", "progress": "regression", "expansion": "contraction", "harmony": "discord",
                    "advance": "retreat", "construct": "demolish", "connect": "disconnect", "include": "exclude", "organize": "disorganize"
                }
            },
            8: {
                "words": ["sophisticated", "phenomenon", "paradigm", "ambiguous", "hypothesis", "implications", "substantiate", "comprehensive", "perspective", "methodology"],
                "synonyms": {
                    "complex": ["sophisticated", "intricate", "elaborate"],
                    "unclear": ["ambiguous", "vague", "indefinite"],
                    "support": ["substantiate", "validate", "corroborate"],
                    "complete": ["comprehensive", "thorough", "extensive"],
                    "method": ["methodology", "approach", "technique"]
                },
                "antonyms": {
                    "certainty": "uncertainty", "objective": "subjective", "permanent": "temporary", "rational": "irrational", "concrete": "abstract",
                    "conservative": "liberal", "optimistic": "pessimistic", "theoretical": "practical", "universal": "particular", "coherent": "incoherent"
                }
            },
            9: {
                "words": ["philosophical", "empirical", "theoretical", "paradigmatic", "hierarchical", "systematic", "conceptual", "fundamental", "transcendent", "ubiquitous"],
                "synonyms": {
                    "fundamental": ["essential", "basic", "foundational"],
                    "systematic": ["methodical", "organized", "structured"],
                    "theoretical": ["conceptual", "abstract", "hypothetical"],
                    "empirical": ["experimental", "observational", "evidence-based"],
                    "ubiquitous": ["universal", "omnipresent", "widespread"]
                },
                "antonyms": {
                    "theoretical": "practical", "abstract": "concrete", "systematic": "random", "fundamental": "superficial", "transcendent": "mundane",
                    "empirical": "theoretical", "hierarchical": "egalitarian", "conceptual": "tangible", "philosophical": "pragmatic", "ubiquitous": "rare"
                }
            },
            10: {
                "words": ["epistemological", "phenomenological", "existential", "ontological", "dialectical", "hermeneutical", "categorical", "axiomatic", "transcendental", "metaphysical"],
                "synonyms": {
                    "existential": ["experiential", "lived", "authentic"],
                    "dialectical": ["conversational", "argumentative", "reasoned"],
                    "categorical": ["absolute", "unconditional", "definitive"],
                    "axiomatic": ["self-evident", "fundamental", "basic"],
                    "transcendental": ["surpassing", "sublime", "elevated"]
                },
                "antonyms": {
                    "existential": "theoretical", "dialectical": "monological", "categorical": "conditional", "axiomatic": "questionable", "transcendental": "immanent",
                    "metaphysical": "physical", "ontological": "practical", "phenomenological": "objective", "epistemological": "intuitive", "hermeneutical": "literal"
                }
            },
            11: {
                "words": ["perspicacious", "sagacious", "perspicuous", "recondite", "abstruse", "erudite", "pedantic", "didactic", "heuristic", "paradigmatic"],
                "synonyms": {
                    "perspicacious": ["insightful", "perceptive", "astute"],
                    "sagacious": ["wise", "prudent", "judicious"],
                    "erudite": ["scholarly", "learned", "knowledgeable"],
                    "recondite": ["obscure", "esoteric", "arcane"],
                    "heuristic": ["investigative", "exploratory", "discovery-based"]
                },
                "antonyms": {
                    "perspicacious": "obtuse", "sagacious": "foolish", "erudite": "ignorant", "recondite": "obvious", "abstruse": "clear",
                    "perspicuous": "obscure", "pedantic": "practical", "didactic": "exploratory", "heuristic": "algorithmic", "paradigmatic": "anomalous"
                }
            }
        }
        
        # COPPA-compliant comprehension passage templates by mood and grade
        self.comprehension_templates = {
            "creative": {
                5: {
                    "gaming": "Maya loves creating characters in her favorite adventure game. She designs heroes with unique skills like puzzle-solving and teamwork. Each character has special abilities that help them explore magical kingdoms. Maya learns that good characters need both strengths and interesting backgrounds. Creating these digital heroes teaches her about storytelling and imagination.",
                    "music": "Tommy discovered he could create simple songs using his computer. He learned that melodies follow patterns, just like math problems. By arranging different notes, he made cheerful tunes for his family. Music creation helped Tommy understand rhythm and timing. He realized that making music combines creativity with careful planning.",
                    "movies": "Sarah enjoys making short videos with her tablet. She learned that good stories need a beginning, middle, and end. Her films often feature her pets going on backyard adventures. Each video teaches her about camera angles and storytelling. Sarah discovered that movie-making requires patience and creative thinking."
                },
                6: {
                    "gaming": "Alex studies how video game designers create engaging characters. Each character must have clear motivations and interesting personality traits. Game developers spend months planning character backstories and abilities. The most memorable characters often face challenges that players can relate to. Understanding character development helps players appreciate the art behind their favorite games.",
                    "music": "Emma learned that composing music involves mathematical principles and creative expression. Musicians use patterns, ratios, and timing to create pleasing sounds. Digital tools now allow young composers to experiment with different instruments and rhythms. The process of writing songs combines technical skills with artistic vision. Many successful composers started learning these principles at a young age.",
                    "history": "The ancient Maya civilization developed one of the most sophisticated writing systems in the Americas. Their hieroglyphic script combined pictures and symbols to record important events and stories. Maya scholars were skilled mathematicians who created accurate calendars. Their achievements in astronomy and architecture continue to amaze researchers today. Understanding Maya culture helps us appreciate human creativity throughout history."
                },
                7: {
                    "gaming": "Modern video game development combines storytelling, psychology, and technology. Character designers must understand human emotions to create relatable protagonists. The most successful games feature characters who grow and change throughout their journey. Players often connect with characters who face realistic challenges and moral decisions. This emotional connection between player and character drives engagement in interactive entertainment.",
                    "music": "Contemporary music composition blends traditional techniques with digital innovation. Composers now use software to experiment with sounds impossible to create acoustically. The creative process involves understanding both musical theory and technological possibilities. Many young musicians find that technology expands rather than limits their creative expression. This fusion of art and technology continues to reshape the music industry.",
                    "movies": "Film narrative structure has evolved significantly since cinema's early days. Modern filmmakers use complex storytelling techniques to engage audiences emotionally. Character development often reflects real social issues and human experiences. The most impactful films combine entertainment with meaningful themes about society and relationships. Understanding narrative techniques helps viewers appreciate the craft behind compelling cinema."
                },
                8: {
                    "gaming": "Interactive entertainment design requires understanding player psychology and engagement mechanics. Successful character development involves creating protagonists who evolve through meaningful choices and consequences. Game narratives often explore complex themes while maintaining accessibility for diverse audiences. The integration of character growth with gameplay mechanics represents a sophisticated form of digital storytelling. This medium continues to mature as both entertainment and artistic expression.",
                    "music": "Musical composition in the digital age combines classical principles with innovative technological tools. Composers must understand both traditional harmony and modern production techniques. The creative process involves balancing artistic vision with technical constraints and audience considerations. Contemporary music often reflects cultural trends while pushing creative boundaries. This evolution demonstrates how technology can enhance rather than replace human creativity."
                }
            },
            "analytical": {
                5: {
                    "gaming": "Game designers use math to make their games fair and fun. They calculate how often players should find treasure or face challenges. Too many rewards make games too easy, while too few make them frustrating. Designers test their games many times to find the perfect balance. This careful planning helps create games that keep players engaged and happy.",
                    "data": "Scientists collect information to understand our world better. They count animals in forests, measure rainfall, and track temperature changes. This data helps them see patterns and make predictions. For example, counting butterflies each year shows if their population is healthy. Data collection requires patience and careful observation skills.",
                    "sports": "Basketball coaches use statistics to help their teams improve. They track how many shots each player makes and misses during practice. This information helps coaches decide which players should take important shots during games. Teams that study their statistics often perform better than those who don't. Numbers help coaches make smart decisions about strategy."
                },
                6: {
                    "gaming": "Video game balance requires sophisticated mathematical analysis of player behavior and game mechanics. Developers collect data on player choices, success rates, and engagement patterns. This information helps them adjust difficulty curves and reward systems. Games that use data-driven design often provide more satisfying player experiences. Understanding player psychology through data analysis has become essential in modern game development.",
                    "music": "Music theory demonstrates mathematical relationships between sounds, rhythms, and harmonies. Composers use ratios and patterns to create pleasing musical arrangements. The frequency of sound waves determines pitch, while rhythm follows mathematical time signatures. Computer analysis can now identify patterns in successful songs across different genres. This mathematical foundation helps both composers and listeners understand what makes music appealing.",
                    "history": "Historians use data analysis to understand patterns in past civilizations and events. They examine population records, trade documents, and archaeological evidence to draw conclusions. Statistical analysis helps researchers identify trends that shaped historical outcomes. For example, examining climate data reveals how weather patterns affected ancient agricultural societies. This analytical approach provides deeper insights into historical cause and effect."
                }
            },
            "competitive": {
                5: {
                    "gaming": "Professional gamers practice for hours each day to improve their skills. They study their opponents' strategies and learn from their mistakes. The best players can make quick decisions under pressure. Gaming tournaments now offer prizes worth millions of dollars. Success requires dedication, teamwork, and constant improvement.",
                    "sports": "Olympic athletes train for years to compete at the highest level. They follow strict schedules for practice, nutrition, and rest. Coaches use video analysis to help athletes improve their techniques. Mental preparation is just as important as physical training. The Olympics showcase the results of incredible dedication and hard work.",
                    "debate": "Debate teams research topics thoroughly before competitions. They practice presenting arguments clearly and responding to opposing viewpoints. Good debaters learn to think quickly and speak confidently. Debate competitions teach students valuable communication and critical thinking skills. These abilities help students succeed in school and future careers."
                },
                6: {
                    "gaming": "Esports has evolved into a legitimate competitive arena with professional leagues and sponsorships. Top players develop specialized skills through intensive practice and strategic analysis. Teams study opponent gameplay patterns and develop counter-strategies. The mental pressure in competitive gaming matches traditional sports in intensity. Success requires not only individual skill but also effective team coordination and communication.",
                    "sports": "Advanced sports analytics now influence coaching decisions and player development strategies. Teams use performance data to optimize training programs and game strategies. Statistical analysis helps identify which tactics are most effective against specific opponents. Modern athletes must understand both physical performance and data-driven improvement methods. This analytical approach has revolutionized how competitive sports are played and coached."
                }
            },
            "relaxed": {
                5: {
                    "nature": "Walking through a peaceful forest helps people feel calm and happy. Trees provide fresh air and homes for many animals. The sound of leaves rustling in the wind creates natural music. Many families enjoy hiking together on quiet forest trails. Spending time in nature helps reduce stress and improves health.",
                    "music": "Classical music has helped people relax for hundreds of years. Gentle melodies can slow down our heartbeat and reduce worry. Many hospitals play soft music to help patients feel more comfortable. Learning about different composers and their peaceful songs can be very enjoyable. Music therapy is now used to help people with various health challenges.",
                    "travel": "Visiting new places teaches us about different cultures and traditions. Every country has unique foods, languages, and customs to discover. Travel helps people become more understanding and open-minded. Even exploring nearby towns can be an exciting adventure. Learning about other places helps us appreciate both diversity and common human experiences."
                },
                6: {
                    "nature": "Natural environments provide essential benefits for human physical and mental wellness. Research shows that exposure to green spaces reduces stress hormones and improves cognitive function. Many people find that regular time outdoors enhances their creativity and problem-solving abilities. Urban planners now recognize the importance of incorporating natural elements into city design. This connection between humans and nature appears to be fundamental to our wellbeing.",
                    "music": "Musical traditions across cultures share common elements that promote relaxation and emotional healing. Researchers have discovered that certain rhythms and harmonies naturally synchronize with human biological processes. Many therapeutic programs now incorporate music to support healing and stress reduction. The universal appeal of calming music suggests deep connections between sound and human psychology. This understanding has led to new applications in healthcare and education."
                }
            },
            "curious": {
                5: {
                    "science": "Scientists recently discovered that octopuses can solve puzzles and remember solutions. These smart sea creatures can open jars, navigate mazes, and even recognize human faces. Some octopuses have been observed using tools to catch food. Their problem-solving abilities surprise researchers who study ocean life. Learning about octopus intelligence helps us understand how different animals think.",
                    "technology": "3D printing allows people to create real objects from computer designs. This amazing technology can make everything from toys to car parts. Some doctors even use 3D printers to create artificial body parts for patients. Students in many schools now learn to design and print their own creations. This technology continues to surprise people with new possibilities.",
                    "mystery": "Archaeologists recently found a hidden chamber in an ancient Egyptian pyramid. They used special cameras and robots to explore areas too dangerous for humans. The chamber contained artifacts that teach us about life thousands of years ago. Many mysteries about ancient civilizations still wait to be solved. Each new discovery helps us understand how people lived in the past."
                },
                6: {
                    "science": "Marine biologists have discovered that dolphins use unique whistle signatures, similar to human names. Each dolphin develops a distinctive sound pattern that other dolphins recognize and respond to. This communication system is more complex than previously understood. Researchers are now studying whether dolphins can learn and use the signature whistles of other dolphins. These findings suggest that dolphin intelligence and social behavior are remarkably sophisticated.",
                    "technology": "Artificial intelligence is revolutionizing how we approach problem-solving in various fields. Machine learning algorithms can now identify patterns in data that humans might miss. Scientists use AI to predict weather patterns, diagnose diseases, and even discover new medicines. However, AI systems require careful programming and human oversight to ensure accurate results. The development of ethical AI remains an important challenge for technologists and society."
                }
            },
            "adventurous": {
                5: {
                    "exploration": "Young explorers Sarah and Jake discovered an old treasure map in their grandfather's attic. The map showed a path through the nearby woods to a mysterious location marked with an X. They packed supplies and carefully followed the trail, solving riddles left by previous adventurers. Their journey taught them about navigation, teamwork, and perseverance. The real treasure turned out to be the confidence they gained from completing their quest.",
                    "travel": "Mountain climbing requires careful planning and safety preparation. Climbers must study weather conditions, pack proper equipment, and inform others of their planned route. Each step up a mountain presents new challenges and amazing views. Successful climbers learn to respect nature's power while pursuing their goals. Many young people discover their strength and determination through outdoor adventure activities.",
                    "risk": "Learning to ride a bicycle involves understanding balance, momentum, and calculated risk-taking. Beginning riders must practice in safe environments before tackling more challenging terrain. Each attempt teaches valuable lessons about persistence and overcoming fear. Many life skills involve similar processes of gradual skill development and confidence building. Adventure activities help young people develop courage and decision-making abilities."
                },
                6: {
                    "exploration": "Archaeological expeditions combine scientific methodology with adventurous discovery. Researchers carefully excavate sites to uncover artifacts that reveal information about past civilizations. Each dig site presents unique challenges requiring problem-solving skills and patience. Modern archaeologists use advanced technology alongside traditional excavation techniques. These expeditions contribute to our understanding of human history while satisfying the human desire for exploration and discovery.",
                    "travel": "Expedition planning requires extensive research, risk assessment, and resource management. Successful adventurers must understand geography, climate patterns, and cultural considerations for their destinations. Modern exploration often involves scientific research goals alongside personal challenge objectives. Technology has made remote communication possible, but explorers still face real risks requiring careful preparation. These adventures contribute to scientific knowledge while inspiring others to pursue their own challenging goals."
                }
            },
            "practical": {
                5: {
                    "math": "Learning to manage money helps kids make smart spending decisions. Sarah saved her allowance for six weeks to buy a new bike that cost sixty dollars. She learned to compare prices at different stores before making purchases. Understanding percentages helped her calculate sales tax and discounts. These money skills will help her throughout her life.",
                    "life_skills": "Cooking teaches important lessons about following directions and measuring ingredients. Learning to prepare simple, healthy meals builds confidence and independence. Many recipes involve fractions and timing, making cooking a practical way to use math skills. Safe cooking habits protect against accidents and food poisoning. These skills help young people contribute to their families and prepare for independence.",
                    "consumer": "Smart shopping involves comparing prices, reading labels, and understanding value. Consumers should research products before making important purchases. Understanding advertising techniques helps people make informed decisions rather than impulsive ones. Learning about warranties and return policies protects consumers from problems. These skills help people get the most value from their money."
                },
                6: {
                    "economics": "Personal financial literacy involves understanding budgeting, saving, and responsible spending habits. Young people who learn to track their income and expenses develop better money management skills. Understanding concepts like interest rates and inflation helps with long-term financial planning. Many schools now teach practical economics to help students prepare for adult financial responsibilities. These skills contribute to personal stability and economic success throughout life.",
                    "applications": "Mathematical concepts appear in numerous everyday situations, from calculating tips to understanding loan payments. Geometry helps with home improvement projects and space planning. Statistics help people evaluate news reports and make informed decisions. Understanding percentages and ratios assists with cooking, sports analysis, and comparison shopping. Recognizing these connections helps students appreciate mathematics as a practical tool rather than just an academic subject."
                }
            },
            "cool": {
                5: {
                    "gaming": "The latest virtual reality games let players explore amazing digital worlds. Players can fly through space, swim with dolphins, or walk through ancient castles. VR technology makes gaming feel more real than ever before. Many schools now use VR to take students on virtual field trips. This technology opens up exciting possibilities for entertainment and education.",
                    "technology": "Smartphones contain more computing power than the computers that sent astronauts to the moon. These devices can take photos, play music, access the internet, and run thousands of different apps. New phones often include features like fingerprint scanners and voice assistants. Understanding how technology works helps young people use it responsibly and creatively. Technology continues to change how we learn, work, and communicate.",
                    "trends": "Social media platforms help people connect with friends and share their interests with others around the world. Many young creators use these platforms to showcase their talents in art, music, and video production. Digital literacy skills help people navigate online spaces safely and effectively. Understanding privacy settings and online etiquette protects users and others. These platforms can inspire creativity and global connections when used thoughtfully."
                },
                6: {
                    "gaming": "Modern gaming technology incorporates advanced physics engines, artificial intelligence, and immersive audio design. Game developers now create experiences that adapt to individual player preferences and skill levels. The integration of social features allows players to collaborate and compete with others globally. Emerging technologies like augmented reality are creating new possibilities for interactive entertainment. The gaming industry continues to push technological boundaries while creating engaging content for diverse audiences.",
                    "technology": "Emerging technologies like quantum computing and neural networks are reshaping our understanding of computational possibilities. These advances promise to revolutionize fields from medicine to environmental science. Young people today are growing up with access to creative tools that previous generations could never imagine. Understanding these technologies helps students prepare for careers that may not even exist yet. The intersection of creativity and technology offers unprecedented opportunities for innovation and problem-solving."
                }
            }
        }
                
        # Grammar error patterns - Comprehensive from Grade 9 workbook
        self.grammar_patterns = {
            "subject_verb": {
                "pattern": "The {subject} {verb} {object}.",
                "errors": [
                    ("students", "is", "working"), # should be "are"
                    ("cats", "runs", "quickly"), # should be "run"
                    ("teacher", "are", "helpful"), # should be "is"
                    ("books", "was", "interesting"), # should be "were"
                ]
            },
            "subject_verb_compound": {
                "pattern": "{subject1} and {subject2} {verb} together.",
                "errors": [
                    ("John", "Mary", "works"), # should be "work"
                    ("The dog", "the cat", "plays"), # should be "play"
                    ("My mother", "father", "cooks"), # should be "cook"
                ]
            },
            "subject_verb_indefinite": {
                "pattern": "{indefinite_pronoun} {verb} the answer.",
                "errors": [
                    ("Everyone", "know"), # should be "knows"
                    ("Nobody", "understand"), # should be "understands"
                    ("Each of the students", "have"), # should be "has"
                    ("Either of the boys", "are"), # should be "is"
                ]
            },
            "pronoun": {
                "pattern": "{pronoun} went to the store.",
                "errors": [
                    ("Me and John", "I and John"), # should be "John and I"
                    ("Him and her", "He and she"), # should be "He and she"
                    ("Us students", "We students"), # should be "We students"
                ]
            },
            "pronoun_antecedent": {
                "pattern": "{noun} lost {pronoun} book.",
                "errors": [
                    ("The student", "their"), # should be "his or her"
                    ("Everyone", "their"), # should be "his or her"
                    ("The team", "their"), # collective noun - can be "its" or "their"
                ]
            },
            "pronoun_reference": {
                "pattern": "When {subject} saw {object}, {pronoun} was surprised.",
                "errors": [
                    ("John", "Mike", "he"), # unclear reference
                    ("The teacher", "the student", "she"), # unclear reference
                ]
            },
            "who_whom": {
                "pattern": "{who_whom} did you see at the party?",
                "errors": [
                    ("Who", "Whom"), # should be "Whom" (object)
                    ("Whom is calling?", "Who is calling?"), # should be "Who" (subject)
                ]
            },
            "adjective_clause": {
                "pattern": "The book {clause} is interesting.",
                "errors": [
                    ("which I read it", "which I read"), # redundant pronoun
                    ("that it belongs to me", "that belongs to me"), # redundant pronoun
                ]
            },
            "adverb_clause": {
                "pattern": "{clause}, she studied harder.",
                "errors": [
                    ("Because she wanted to pass", "correct"), # correct example
                    ("Although being tired", "Although she was tired"), # missing subject
                ]
            },
            "noun_clause": {
                "pattern": "{clause} surprised everyone.",
                "errors": [
                    ("That he won", "correct"), # correct example
                    ("What did he say", "What he said"), # wrong word order
                ]
            },
            "gerunds": {
                "pattern": "{gerund} is good exercise.",
                "errors": [
                    ("To swim", "Swimming"), # infinitive vs gerund
                    ("Swim", "Swimming"), # base form vs gerund
                ]
            },
            "infinitives": {
                "pattern": "She wants {infinitive}.",
                "errors": [
                    ("going", "to go"), # gerund vs infinitive
                    ("that she goes", "to go"), # clause vs infinitive
                ]
            },
            "modifiers": {
                "pattern": "{modifier}, the student answered the question.",
                "errors": [
                    ("Walking to class", "correct"), # correct participial phrase
                    ("Having been studied", "Having studied"), # wrong form
                ]
            },
            "modifiers_misplaced": {
                "pattern": "She saw {object} {modifier}.",
                "errors": [
                    ("the man with binoculars", "correct/ambiguous"), # who has binoculars?
                    ("the cake on the table that was chocolate", "the chocolate cake on the table"), # misplaced modifier
                ]
            },
            "modifiers_dangling": {
                "pattern": "{modifier}, {main_clause}.",
                "errors": [
                    ("Running down the street", "the bus was missed"), # dangling - who was running?
                    ("After studying all night", "the test was easy"), # dangling - who studied?
                ]
            },
            "comparisons": {
                "pattern": "This book is {comparison} than that one.",
                "errors": [
                    ("more better", "better"), # double comparison
                    ("gooder", "better"), # wrong form
                    ("more unique", "unique"), # absolute adjective
                ]
            },
            "comparisons_incomplete": {
                "pattern": "She likes math {comparison}.",
                "errors": [
                    ("more than English", "correct"), # complete comparison
                    ("more", "more than other subjects"), # incomplete
                ]
            },
            "good_well": {
                "pattern": "She plays the piano {adverb}.",
                "errors": [
                    ("good", "well"), # adjective vs adverb
                    ("She feels good", "correct"), # linking verb + adjective
                ]
            },
            "bad_badly": {
                "pattern": "He performed {adverb} on the test.",
                "errors": [
                    ("bad", "badly"), # adjective vs adverb
                    ("The food tastes bad", "correct"), # linking verb + adjective
                ]
            },
            "double_negatives": {
                "pattern": "I {negative1} have {negative2}.",
                "errors": [
                    ("don't", "nothing"), # double negative
                    ("haven't", "no money"), # double negative
                    ("can't", "hardly"), # double negative (hardly is negative)
                ]
            },
            "tense": {
                "pattern": "Yesterday, I {verb} to school.",
                "errors": [
                    ("go", "went"),
                    ("walk", "walked"),
                    ("run", "ran"),
                    ("drive", "drove")
                ]
            },
            "usage_common": {
                "pattern": "Common usage errors",
                "errors": [
                    ("accept/except", "I accept your apology / Everyone except John"),
                    ("affect/effect", "The weather affects mood / The effect was dramatic"),
                    ("among/between", "Between two people / Among many people"),
                    ("amount/number", "Amount of water / Number of bottles"),
                    ("allot/a lot", "Allot time for study / A lot of homework"),
                    ("all right/alright", "All right is standard / Alright is informal"),
                    ("all together/altogether", "All together now / Altogether different"),
                    ("already/all ready", "Already finished / All ready to go"),
                    ("anyway/any way", "Anyway, let's start / Is there any way to help?"),
                    ("beside/besides", "Sit beside me / Besides that issue"),
                    ("bring/take", "Bring it here / Take it there"),
                    ("can/may", "Can you do it? / May I help you?"),
                    ("fewer/less", "Fewer students / Less homework"),
                    ("farther/further", "Farther distance / Further discussion"),
                    ("its/it's", "Its tail / It's raining"),
                    ("lay/lie", "Lay the book down / Lie on the bed"),
                    ("lose/loose", "Lose the game / Loose clothing"),
                    ("passed/past", "Passed the test / Past experiences"),
                    ("precede/proceed", "Precede means come before / Proceed means continue"),
                    ("principal/principle", "School principal / Scientific principle"),
                    ("than/then", "Better than / First this, then that"),
                    ("their/there/they're", "Their book / Over there / They're coming"),
                    ("to/too/two", "Go to school / Too much / Two apples"),
                    ("weather/whether", "Weather forecast / Whether or not"),
                    ("who's/whose", "Who's coming? / Whose book?"),
                    ("your/you're", "Your book / You're welcome")
                ]
            },
            "appositives": {
                "pattern": "Appositive punctuation and usage",
                "errors": [
                    ("My friend Sarah is here.", "My friend, Sarah, is here."), # if only one friend
                    ("The author, Mark Twain wrote many books.", "The author Mark Twain wrote many books."), # restrictive
                    ("My brother, the doctor is visiting.", "My brother, the doctor, is visiting."), # non-restrictive needs both commas
                    ("John my neighbor, helped me.", "John, my neighbor, helped me."), # non-restrictive appositive
                    ("The planet Mars, is red.", "The planet Mars is red.") # no comma needed for restrictive
                ]
            },
            "prepositional_phrases": {
                "pattern": "Prepositional phrase placement and usage",
                "errors": [
                    ("The book on the table which is red.", "The red book on the table."), # misplaced modifier
                    ("He gave the gift to Mary from John.", "He gave Mary the gift from John."), # awkward placement
                    ("In the morning, I usually in the park run.", "In the morning, I usually run in the park."), # word order
                    ("She is good in math.", "She is good at math."), # wrong preposition
                    ("Different than others.", "Different from others.") # wrong preposition
                ]
            }
        }

    def generate_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate a question based on configuration."""
        
        if config.topic.startswith("math_"):
            return self._generate_math_question(config)
        elif config.topic.startswith("english_"):
            return self._generate_english_question(config)
        else:
            raise ValueError(f"Unsupported topic: {config.topic}")

    def _generate_math_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate math questions."""
        
        if config.topic == Topic.MATH_ALGEBRA.value:
            return self._generate_algebra_question(config)
        elif config.topic == Topic.MATH_GEOMETRY.value:
            return self._generate_geometry_question(config)
        elif config.topic == Topic.MATH_NUMBER_THEORY.value:
            return self._generate_number_theory_question(config)
        elif config.topic == Topic.MATH_STATISTICS.value:
            return self._generate_statistics_question(config)
        elif config.topic == Topic.MATH_PRECALCULUS.value:
            return self._generate_precalculus_question(config)
        elif config.topic == Topic.MATH_CALCULUS.value:
            return self._generate_calculus_question(config)
        else:
            raise ValueError(f"Unsupported math topic: {config.topic}")

    def _generate_english_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate English questions."""
        
        if config.topic == Topic.ENGLISH_GRAMMAR.value:
            return self._generate_grammar_question(config)
        elif config.topic == Topic.ENGLISH_VOCABULARY.value:
            return self._generate_vocabulary_question(config)
        elif config.topic == Topic.ENGLISH_SYNONYMS.value:
            return self._generate_synonym_question(config)
        elif config.topic == Topic.ENGLISH_ANTONYMS.value:
            return self._generate_antonym_question(config)
        elif config.topic == Topic.ENGLISH_SENTENCES.value:
            return self._generate_sentence_completion_question(config)
        elif config.topic == Topic.ENGLISH_COMPREHENSION.value:
            return self._generate_comprehension_question(config)
        else:
            raise ValueError(f"Unsupported English topic: {config.topic}")

    def _generate_algebra_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate algebra questions."""
        
        # Scale complexity based on grade and difficulty
        if config.grade <= 6:
            # Simple linear equations: x + a = b
            a = random.randint(1, 20)
            b = random.randint(a + 1, 50)
            x = b - a
            
            question_text = f"Solve for x: x + {a} = {b}"
            correct_answer = str(x)
            options = [str(x), str(x + 1), str(x - 1), str(a)]
            explanation = f"Subtract {a} from both sides: x = {b} - {a} = {x}"
            
        elif config.grade <= 8:
            # Linear equations: ax + b = c
            a = random.randint(2, 8)
            b = random.randint(1, 15)
            c = random.randint(b + a, 50)
            x = (c - b) // a if (c - b) % a == 0 else (c - b) / a
            
            question_text = f"Solve for x: {a}x + {b} = {c}"
            correct_answer = str(int(x)) if x == int(x) else f"{c - b}/{a}"
            options = [correct_answer, str(int(x) + 1), str(int(x) - 1), str(b)]
            explanation = f"Subtract {b} from both sides, then divide by {a}: x = ({c} - {b})/{a} = {correct_answer}"
            
        else:
            # Quadratic equations: x² + bx + c = 0
            # Generate with integer solutions
            r1, r2 = random.randint(-5, 5), random.randint(-5, 5)
            b = -(r1 + r2)
            c = r1 * r2
            
            question_text = f"Find the solutions to x² + {b}x + {c} = 0"
            correct_answer = f"x = {r1}, {r2}" if r1 <= r2 else f"x = {r2}, {r1}"
            options = [correct_answer, f"x = {r1 + 1}, {r2}", f"x = {r1}, {r2 + 1}", f"x = {-r1}, {-r2}"]
            explanation = f"Factor as (x - {r1})(x - {r2}) = 0, so x = {r1} or x = {r2}"

        question_hash = self._generate_hash(question_text, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=["Isolate the variable", "Perform the same operation on both sides"],
            question_hash=question_hash
        )

    def _generate_geometry_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate geometry questions."""
        
        if config.grade <= 6:
            # Area and perimeter of rectangles
            length = random.randint(5, 20)
            width = random.randint(3, 15)
            
            if random.choice([True, False]):
                # Area question
                area = length * width
                question_text = f"What is the area of a rectangle with length {length} cm and width {width} cm?"
                correct_answer = f"{area} cm²"
                options = [correct_answer, f"{area + 10} cm²", f"{length + width} cm²", f"{area - 5} cm²"]
                explanation = f"Area = length × width = {length} × {width} = {area} cm²"
            else:
                # Perimeter question
                perimeter = 2 * (length + width)
                question_text = f"What is the perimeter of a rectangle with length {length} cm and width {width} cm?"
                correct_answer = f"{perimeter} cm"
                options = [correct_answer, f"{perimeter + 4} cm", f"{length * width} cm", f"{perimeter - 4} cm"]
                explanation = f"Perimeter = 2(length + width) = 2({length} + {width}) = {perimeter} cm"
        
        elif config.grade <= 8:
            # Circle area and circumference
            radius = random.randint(3, 15)
            
            if random.choice([True, False]):
                # Area question
                area = 3.14159 * radius * radius
                question_text = f"What is the area of a circle with radius {radius} units? (Use π ≈ 3.14)"
                correct_answer = f"{area:.1f} square units"
                options = [correct_answer, f"{area + 10:.1f} square units", f"{2 * 3.14 * radius:.1f} square units", f"{area - 10:.1f} square units"]
                explanation = f"Area = πr² = 3.14 × {radius}² = 3.14 × {radius * radius} = {area:.1f} square units"
            else:
                # Circumference question
                circumference = 2 * 3.14159 * radius
                question_text = f"What is the circumference of a circle with radius {radius} units? (Use π ≈ 3.14)"
                correct_answer = f"{circumference:.1f} units"
                options = [correct_answer, f"{circumference + 5:.1f} units", f"{3.14 * radius * radius:.1f} units", f"{circumference - 5:.1f} units"]
                explanation = f"Circumference = 2πr = 2 × 3.14 × {radius} = {circumference:.1f} units"
        
        else:
            # Volume and surface area
            if random.choice([True, False]):
                # Cylinder volume
                radius = random.randint(2, 8)
                height = random.randint(5, 15)
                volume = 3.14159 * radius * radius * height
                question_text = f"What is the volume of a cylinder with radius {radius} units and height {height} units? (Use π ≈ 3.14)"
                correct_answer = f"{volume:.1f} cubic units"
                options = [correct_answer, f"{volume + 20:.1f} cubic units", f"{2 * 3.14 * radius * height:.1f} cubic units", f"{volume - 20:.1f} cubic units"]
                explanation = f"Volume = πr²h = 3.14 × {radius}² × {height} = {volume:.1f} cubic units"
            else:
                # Sphere volume
                radius = random.randint(3, 10)
                volume = (4/3) * 3.14159 * radius * radius * radius
                question_text = f"What is the volume of a sphere with radius {radius} units? (Use π ≈ 3.14)"
                correct_answer = f"{volume:.1f} cubic units"
                options = [correct_answer, f"{volume + 30:.1f} cubic units", f"{3.14 * radius * radius:.1f} cubic units", f"{volume - 30:.1f} cubic units"]
                explanation = f"Volume = (4/3)πr³ = (4/3) × 3.14 × {radius}³ = {volume:.1f} cubic units"

        question_hash = self._generate_hash(question_text, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=["Remember the formula", "Substitute the given values"],
            question_hash=question_hash
        )

    def _generate_number_theory_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate number theory questions."""
        
        if config.grade <= 6:
            # Basic division and remainders
            dividend = random.randint(20, 100)
            divisor = random.randint(3, 12)
            quotient = dividend // divisor
            remainder = dividend % divisor
            
            question_text = f"What is {dividend} ÷ {divisor}?"
            
            if remainder == 0:
                correct_answer = str(quotient)
                options = [correct_answer, str(quotient + 1), str(quotient - 1), f"{quotient} remainder 1"]
                explanation = f"{dividend} ÷ {divisor} = {quotient}"
            else:
                correct_answer = f"{quotient} remainder {remainder}"
                options = [correct_answer, f"{quotient + 1} remainder {remainder}", f"{quotient} remainder {remainder + 1}", str(quotient)]
                explanation = f"{dividend} ÷ {divisor} = {quotient} remainder {remainder}"
        
        elif config.grade <= 8:
            # Prime factorization
            number = random.choice([12, 18, 24, 30, 36, 42, 48, 54, 60, 72])
            factors = self._prime_factorization(number)
            
            question_text = f"What is the prime factorization of {number}?"
            correct_answer = " × ".join(map(str, factors))
            
            # Generate wrong options by changing one factor
            wrong1 = factors[:]
            wrong1[0] = wrong1[0] + 1 if wrong1[0] < 7 else wrong1[0] - 1
            
            wrong2 = factors[:]
            if len(wrong2) > 1:
                wrong2[1] = wrong2[1] + 1 if wrong2[1] < 7 else wrong2[1] - 1
            
            wrong3 = [number // 2, 2] if number % 2 == 0 else [number // 3, 3]
            
            options = [
                correct_answer,
                " × ".join(map(str, wrong1)),
                " × ".join(map(str, wrong2)),
                " × ".join(map(str, wrong3))
            ]
            explanation = f"Prime factorization breaks {number} down into its prime factors: {correct_answer}"
        
        else:
            # GCD and LCM
            a = random.randint(12, 48)
            b = random.randint(8, 36)
            gcd_val = self._gcd(a, b)
            
            question_text = f"What is the greatest common divisor (GCD) of {a} and {b}?"
            correct_answer = str(gcd_val)
            options = [correct_answer, str(gcd_val * 2), str(gcd_val + 1), str(min(a, b))]
            explanation = f"The GCD of {a} and {b} is {gcd_val}"

        question_hash = self._generate_hash(question_text, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=["Break down the problem step by step", "Look for common factors"],
            question_hash=question_hash
        )

    def _generate_statistics_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate statistics questions."""
        
        # Generate a dataset
        data_size = 5 if config.grade <= 7 else random.randint(6, 10)
        data = [random.randint(10, 50) for _ in range(data_size)]
        
        stat_type = random.choice(["mean", "median", "mode", "range"])
        
        if stat_type == "mean":
            mean_val = sum(data) / len(data)
            question_text = f"Find the mean of this dataset: {', '.join(map(str, data))}"
            correct_answer = f"{mean_val:.1f}" if mean_val != int(mean_val) else str(int(mean_val))
            options = [correct_answer, str(int(mean_val) + 2), str(max(data)), str(int(mean_val) - 1)]
            explanation = f"Mean = sum of all values ÷ number of values = {sum(data)} ÷ {len(data)} = {correct_answer}"
            
        elif stat_type == "median":
            sorted_data = sorted(data)
            n = len(sorted_data)
            if n % 2 == 0:
                median_val = (sorted_data[n//2 - 1] + sorted_data[n//2]) / 2
            else:
                median_val = sorted_data[n//2]
            
            question_text = f"Find the median of this dataset: {', '.join(map(str, data))}"
            correct_answer = f"{median_val:.1f}" if median_val != int(median_val) else str(int(median_val))
            options = [correct_answer, str(int(median_val) + 2), str(max(data)), str(int(median_val) - 1)]
            explanation = f"Median is the middle value when data is sorted: {correct_answer}"
            
        elif stat_type == "range":
            range_val = max(data) - min(data)
            question_text = f"Find the range of this dataset: {', '.join(map(str, data))}"
            correct_answer = str(range_val)
            options = [correct_answer, str(range_val + 5), str(max(data)), str(range_val - 2)]
            explanation = f"Range = maximum - minimum = {max(data)} - {min(data)} = {range_val}"
        
        else:  # mode
            # Ensure there's a mode by duplicating a value
            mode_val = random.choice(data)
            data.append(mode_val)
            
            question_text = f"Find the mode of this dataset: {', '.join(map(str, data))}"
            correct_answer = str(mode_val)
            
            # Generate options that aren't the mode
            other_vals = [x for x in data if x != mode_val]
            options = [correct_answer] + random.sample(other_vals, min(3, len(other_vals)))
            if len(options) < 4:
                options.extend([str(mode_val + i) for i in range(1, 5 - len(options))])
            
            explanation = f"Mode is the most frequently occurring value: {mode_val}"

        question_hash = self._generate_hash(question_text, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options[:4],  # Ensure only 4 options
            explanation=explanation,
            hints=["Organize the data first", "Remember the definition"],
            question_hash=question_hash
        )

    def _generate_precalculus_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate precalculus questions."""
        
        # Function transformations and properties
        if config.difficulty <= 5:
            # Function evaluation
            a = random.randint(2, 6)
            b = random.randint(1, 8)
            x_val = random.randint(1, 5)
            result = a * x_val + b
            
            question_text = f"If f(x) = {a}x + {b}, what is f({x_val})?"
            correct_answer = str(result)
            options = [correct_answer, str(result + a), str(result - b), str(a * x_val)]
            explanation = f"f({x_val}) = {a}({x_val}) + {b} = {a * x_val} + {b} = {result}"
            
        else:
            # Quadratic vertex form
            a = random.randint(1, 4)
            h = random.randint(-3, 3)
            k = random.randint(-2, 5)
            
            question_text = f"What is the vertex of the parabola f(x) = {a}(x - {h})² + {k}?"
            correct_answer = f"({h}, {k})"
            options = [correct_answer, f"({-h}, {k})", f"({h}, {-k})", f"({a}, {h})"]
            explanation = f"For f(x) = a(x - h)² + k, the vertex is (h, k) = ({h}, {k})"

        question_hash = self._generate_hash(question_text, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=["Substitute the value carefully", "Remember the vertex form"],
            question_hash=question_hash
        )

    def _generate_calculus_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate calculus questions."""
        
        # Basic derivatives using power rule
        coefficient = random.randint(2, 8)
        power = random.randint(2, 5)
        
        question_text = f"Find the derivative of f(x) = {coefficient}x^{power}"
        
        # Apply power rule: d/dx(ax^n) = n*a*x^(n-1)
        new_coefficient = coefficient * power
        new_power = power - 1
        
        if new_power == 1:
            correct_answer = f"{new_coefficient}x"
        elif new_power == 0:
            correct_answer = str(new_coefficient)
        else:
            correct_answer = f"{new_coefficient}x^{new_power}"
        
        # Generate wrong options
        options = [
            correct_answer,
            f"{coefficient}x^{power - 1}",  # Forgot to multiply by power
            f"{new_coefficient}x^{power}",  # Forgot to reduce power
            f"x^{power - 1}"  # Forgot coefficient entirely
        ]
        
        explanation = f"Using the power rule: d/dx({coefficient}x^{power}) = {power} × {coefficient}x^{power-1} = {correct_answer}"

        question_hash = self._generate_hash(question_text, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=["Use the power rule", "Multiply by the original power, then reduce the power by 1"],
            question_hash=question_hash
        )

    def _generate_grammar_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate grammar questions based on Grade 9 workbook topics."""
        
        # Select error types based on grade level
        if config.grade <= 5:
            error_types = ["subject_verb", "pronoun", "tense", "good_well", "usage_common"]
        elif config.grade <= 6:
            error_types = ["subject_verb", "subject_verb_compound", "pronoun", "tense", "modifiers", 
                          "comparisons", "usage_common", "prepositional_phrases"]
        elif config.grade <= 7:
            error_types = ["subject_verb_indefinite", "pronoun_antecedent", "who_whom", "adjective_clause", 
                          "modifiers_misplaced", "good_well", "bad_badly", "appositives"]
        elif config.grade <= 8:
            error_types = ["pronoun_reference", "adverb_clause", "noun_clause", "gerunds", "infinitives",
                          "modifiers_dangling", "comparisons_incomplete", "double_negatives", "appositives"]
        else:  # Grades 9-11
            # All grammar types for advanced students
            error_types = list(self.grammar_patterns.keys())
        
        error_type = random.choice(error_types)
        
        # Generate questions based on the selected error type
        if error_type == "subject_verb":
            errors = [
                ("The students is working hard.", "The students are working hard."),
                ("The collection of books were impressive.", "The collection of books was impressive."),
                ("Mathematics are my favorite subject.", "Mathematics is my favorite subject."),
                ("The news about the accidents were shocking.", "The news about the accidents was shocking."),
                ("Politics influence many decisions.", "Politics influences many decisions.")
            ]
        
        elif error_type == "subject_verb_compound":
            errors = [
                ("Tom and Jerry is best friends.", "Tom and Jerry are best friends."),
                ("The teacher and the principal was at the meeting.", "The teacher and the principal were at the meeting."),
                ("Bread and butter are my favorite breakfast.", "Bread and butter is my favorite breakfast."), # compound subject as single unit
                ("Neither the students nor the teacher were ready.", "Neither the students nor the teacher was ready."), # verb agrees with closer subject
                ("Either the cats or the dog are making noise.", "Either the cats or the dog is making noise.")
            ]
        
        elif error_type == "subject_verb_indefinite":
            errors = [
                ("Everyone have their own opinion.", "Everyone has their own opinion."),
                ("Each of the students are unique.", "Each of the students is unique."),
                ("Nobody know the answer.", "Nobody knows the answer."),
                ("Someone need to help.", "Someone needs to help."),
                ("Either of the options are acceptable.", "Either of the options is acceptable.")
            ]
        
        elif error_type == "pronoun_antecedent":
            errors = [
                ("Every student must bring their book.", "Every student must bring his or her book."),
                ("Each person should do their best.", "Each person should do his or her best."),
                ("The committee made their decision.", "The committee made its decision."), # collective noun
                ("Neither girl brought their lunch.", "Neither girl brought her lunch."),
                ("Someone left their backpack.", "Someone left his or her backpack.")
            ]
        
        elif error_type == "pronoun_reference":
            errors = [
                ("When John met Mike, he was surprised.", "When John met Mike, John was surprised."), # unclear reference
                ("Sarah told Mary that she won the prize.", "Sarah told Mary, 'I won the prize.'"), # unclear reference
                ("The vase fell off the table and it broke.", "The vase fell off the table and broke."), # unnecessary pronoun
                ("In the newspaper, it says rain is expected.", "The newspaper says rain is expected."), # vague 'it'
                ("They say that exercise is important.", "Experts say that exercise is important.") # vague 'they'
            ]
        
        elif error_type == "who_whom":
            errors = [
                ("Who did you give the book to?", "Whom did you give the book to?"),
                ("Whom is coming to dinner?", "Who is coming to dinner?"),
                ("The person who you met is my teacher.", "The person whom you met is my teacher."),
                ("I wonder whom will win.", "I wonder who will win."),
                ("To who should I address this letter?", "To whom should I address this letter?")
            ]
        
        elif error_type == "adjective_clause":
            errors = [
                ("The book which I read it was interesting.", "The book which I read was interesting."),
                ("The student that she won the award is here.", "The student that won the award is here."),
                ("The car, that is red, belongs to me.", "The car, which is red, belongs to me."), # non-restrictive clause
                ("The house where I live there is old.", "The house where I live is old."),
                ("The reason why I came here it is important.", "The reason why I came here is important.")
            ]
        
        elif error_type == "adverb_clause":
            errors = [
                ("Although being tired, she continued.", "Although she was tired, she continued."),
                ("Because of he was late, we waited.", "Because he was late, we waited."),
                ("While eating dinner, the phone rang.", "While I was eating dinner, the phone rang."), # dangling
                ("After to finish homework, she relaxed.", "After finishing homework, she relaxed."),
                ("Unless you don't study, you'll fail.", "Unless you study, you'll fail.") # double negative
            ]
        
        elif error_type == "noun_clause":
            errors = [
                ("What did he say surprised me.", "What he said surprised me."),
                ("That why she left is unclear.", "Why she left is unclear."),
                ("I don't know what is he doing.", "I don't know what he is doing."),
                ("Whether will it rain is uncertain.", "Whether it will rain is uncertain."),
                ("The fact that she won it amazed everyone.", "The fact that she won amazed everyone.")
            ]
        
        elif error_type == "gerunds":
            errors = [
                ("To swim is good exercise.", "Swimming is good exercise."), # gerund as subject preferred
                ("I enjoy to read books.", "I enjoy reading books."),
                ("She is good at to sing.", "She is good at singing."),
                ("After to eat, we left.", "After eating, we left."),
                ("He admitted to cheat on the test.", "He admitted cheating on the test.")
            ]
        
        elif error_type == "infinitives":
            errors = [
                ("She wants going to the party.", "She wants to go to the party."),
                ("It's important being on time.", "It's important to be on time."),
                ("He decided leaving early.", "He decided to leave early."),
                ("They plan visiting tomorrow.", "They plan to visit tomorrow."),
                ("I hope seeing you soon.", "I hope to see you soon.")
            ]
        
        elif error_type == "modifiers":
            errors = [
                ("Walking quickly down the street, she arrived.", "Walking quickly down the street, she arrived."), # correct
                ("Being a rainy day, I stayed inside.", "Because it was a rainy day, I stayed inside."),
                ("Having been finished the work, he left.", "Having finished the work, he left."),
                ("Considered carefully, the plan seems good.", "When considered carefully, the plan seems good."),
                ("To understand better, the book was reread.", "To understand better, I reread the book.")
            ]
        
        elif error_type == "modifiers_misplaced":
            errors = [
                ("I saw the man with binoculars.", "I used binoculars to see the man."), # ambiguous
                ("She served sandwiches to the children on paper plates.", "She served sandwiches on paper plates to the children."),
                ("The student earned an A who studied hard.", "The student who studied hard earned an A."),
                ("We saw many deer driving through the park.", "Driving through the park, we saw many deer."),
                ("He nearly drove the car for six hours.", "He drove the car for nearly six hours.")
            ]
        
        elif error_type == "modifiers_dangling":
            errors = [
                ("Running down the street, the bus was missed.", "Running down the street, I missed the bus."),
                ("After studying all night, the test seemed easy.", "After studying all night, I found the test easy."),
                ("To improve your grade, the homework must be completed.", "To improve your grade, you must complete the homework."),
                ("While cooking dinner, the smoke alarm went off.", "While I was cooking dinner, the smoke alarm went off."),
                ("Having finished the assignment, the TV was turned on.", "Having finished the assignment, she turned on the TV.")
            ]
        
        elif error_type == "comparisons":
            errors = [
                ("This book is more better than that one.", "This book is better than that one."),
                ("She is the most smartest student.", "She is the smartest student."),
                ("This solution is more unique.", "This solution is unique."), # absolute adjective
                ("He runs more faster than me.", "He runs faster than me."),
                ("This is the bestest day ever.", "This is the best day ever.")
            ]
        
        elif error_type == "comparisons_incomplete":
            errors = [
                ("I like pizza more.", "I like pizza more than pasta."),
                ("She studies harder.", "She studies harder than her classmates."),
                ("This car is faster.", "This car is faster than that one."),
                ("Math is more interesting.", "Math is more interesting than history."),
                ("He works better.", "He works better alone than in groups.")
            ]
        
        elif error_type == "good_well":
            errors = [
                ("She sings good.", "She sings well."),
                ("The food tastes well.", "The food tastes good."),
                ("He doesn't feel good.", "He doesn't feel well."), # health context
                ("You did good on the test.", "You did well on the test."),
                ("This works good for me.", "This works well for me.")
            ]
        
        elif error_type == "bad_badly":
            errors = [
                ("He played bad in the game.", "He played badly in the game."),
                ("The milk smells badly.", "The milk smells bad."),
                ("I feel badly about the mistake.", "I feel bad about the mistake."), # emotion, not touch
                ("She wants it bad.", "She wants it badly."),
                ("The injury hurts bad.", "The injury hurts badly.")
            ]
        
        elif error_type == "double_negatives":
            errors = [
                ("I don't have nothing.", "I don't have anything."),
                ("She can't hardly wait.", "She can hardly wait."),
                ("We haven't seen nobody.", "We haven't seen anybody."),
                ("I can't find it nowhere.", "I can't find it anywhere."),
                ("There isn't no solution.", "There isn't any solution.")
            ]
        
        elif error_type == "pronoun":
            errors = [
                ("Me and Sarah went to the store.", "Sarah and I went to the store."),
                ("The gift is for John and I.", "The gift is for John and me."),
                ("Us students finished the project.", "We students finished the project."),
                ("Between you and I, it's difficult.", "Between you and me, it's difficult."),
                ("Him and her are coming later.", "He and she are coming later.")
            ]
        
        elif error_type == "usage_common":
            # Common usage errors - select from the patterns
            usage_pairs = [
                ("I could care less about that.", "I couldn't care less about that."),
                ("Please except my apology.", "Please accept my apology."),
                ("The medicine had a good affect.", "The medicine had a good effect."),
                ("Divide the candy between the three children.", "Divide the candy among the three children."),
                ("A large amount of people attended.", "A large number of people attended."),
                ("Its going to rain today.", "It's going to rain today."),
                ("I need to lay down for a while.", "I need to lie down for a while."),
                ("Your going to love this movie.", "You're going to love this movie."),
                ("I past the test yesterday.", "I passed the test yesterday."),
                ("The principle of the school is strict.", "The principal of the school is strict.")
            ]
            errors = usage_pairs
            
        elif error_type == "appositives":
            errors = [
                ("My sister Sarah is a doctor.", "My sister, Sarah, is a doctor."), # if only one sister
                ("The author, Stephen King, wrote many novels.", "The author Stephen King wrote many novels."), # restrictive - many authors
                ("My teacher Mrs. Smith, is helpful.", "My teacher, Mrs. Smith, is helpful."),
                ("The city Chicago, is cold in winter.", "The city Chicago is cold in winter."), # restrictive
                ("Tom, my best friend is visiting.", "Tom, my best friend, is visiting.")
            ]
            
        elif error_type == "prepositional_phrases":
            errors = [
                ("She is interested about science.", "She is interested in science."),
                ("He is capable to do it.", "He is capable of doing it."),
                ("Different than what I expected.", "Different from what I expected."),
                ("Comply to the rules.", "Comply with the rules."),
                ("In regards of your question.", "In regard to your question.")
            ]
            
        else:  # tense
            errors = [
                ("Yesterday, I go to school early.", "Yesterday, I went to school early."),
                ("She has ate her lunch already.", "She has eaten her lunch already."),
                ("They was running in the park.", "They were running in the park."),
                ("I seen that movie before.", "I saw that movie before."),
                ("He have finished his homework.", "He has finished his homework.")
            ]
        
        incorrect, correct = random.choice(errors)
        
        question_text = f"Which sentence is grammatically correct?"
        
        # Create options with the correct answer and variations
        options = [
            correct,
            incorrect,
            self._create_grammar_distractor(correct, 1),
            self._create_grammar_distractor(correct, 2)
        ]
        
        random.shuffle(options)
        correct_answer = correct
        
        # Generate appropriate explanation based on error type
        explanations = {
            "subject_verb": "Subject and verb must agree in number.",
            "subject_verb_compound": "Compound subjects joined by 'and' usually take plural verbs.",
            "subject_verb_indefinite": "Indefinite pronouns like 'everyone' and 'each' are singular.",
            "pronoun": "Use the correct pronoun case (subjective/objective) for the sentence position.",
            "pronoun_antecedent": "Pronouns must agree with their antecedents in person, number, and gender.",
            "pronoun_reference": "Pronouns must have clear, unambiguous antecedents.",
            "who_whom": "'Who' is for subjects; 'whom' is for objects.",
            "adjective_clause": "Avoid redundant pronouns in adjective clauses.",
            "adverb_clause": "Adverb clauses need complete subjects and verbs.",
            "noun_clause": "Noun clauses use statement word order, not question word order.",
            "gerunds": "Use gerunds (verb + -ing) as nouns after certain verbs and prepositions.",
            "infinitives": "Use infinitives (to + verb) after certain verbs and adjectives.",
            "modifiers": "Participial phrases must clearly modify a specific noun.",
            "modifiers_misplaced": "Place modifiers near the words they modify to avoid ambiguity.",
            "modifiers_dangling": "Dangling modifiers lack a clear subject to modify.",
            "comparisons": "Avoid double comparisons and use correct comparative forms.",
            "comparisons_incomplete": "Comparisons must include both items being compared.",
            "good_well": "'Good' is an adjective; 'well' is usually an adverb.",
            "bad_badly": "'Bad' is an adjective; 'badly' is an adverb.",
            "double_negatives": "Avoid using two negative words in the same clause.",
            "tense": "Use the correct verb tense for the time reference.",
            "usage_common": "Common usage errors often involve confused word pairs. Learn the differences.",
            "appositives": "Appositives rename nouns. Use commas for non-restrictive appositives only.",
            "prepositional_phrases": "Use correct prepositions and place prepositional phrases clearly."
        }
        
        explanation = f"The correct sentence is: '{correct}'. {explanations.get(error_type, '')}"
        
        # Generate contextual hints based on error type
        hint_map = {
            "subject_verb": ["Identify the subject", "Check if it's singular or plural", "Match the verb form"],
            "subject_verb_compound": ["Find all parts of the subject", "Check if joined by 'and' or 'or'", "Apply agreement rules"],
            "subject_verb_indefinite": ["Identify indefinite pronouns", "Remember most are singular", "Check verb agreement"],
            "pronoun": ["Identify pronoun position", "Subject = I, he, she, we, they", "Object = me, him, her, us, them"],
            "pronoun_antecedent": ["Find the pronoun's antecedent", "Check number and gender", "Ensure agreement"],
            "pronoun_reference": ["Find what the pronoun refers to", "Check for ambiguity", "Clarify if needed"],
            "who_whom": ["Is it doing the action (who)?", "Is it receiving the action (whom)?", "Try substituting he/him"],
            "adjective_clause": ["Find the relative pronoun", "Check for redundant pronouns", "Simplify the clause"],
            "adverb_clause": ["Identify the subordinating conjunction", "Check for complete subject and verb", "Ensure proper structure"],
            "noun_clause": ["Identify the clause function", "Use statement word order", "Check completeness"],
            "gerunds": ["Look for verbs used as nouns", "Add -ing to the verb", "Check after prepositions"],
            "infinitives": ["Look for verb patterns", "Add 'to' before the verb", "Check after certain verbs"],
            "modifiers": ["Find the modifying phrase", "Identify what it modifies", "Check placement"],
            "modifiers_misplaced": ["Find the modifier", "What should it modify?", "Move it closer"],
            "modifiers_dangling": ["Find the opening phrase", "Who/what does the action?", "Add the missing subject"],
            "comparisons": ["Check for double comparisons", "Use -er OR more, not both", "Check absolute adjectives"],
            "comparisons_incomplete": ["What two things are compared?", "Include both items", "Complete the comparison"],
            "good_well": ["Is it modifying a noun (good)?", "Is it modifying a verb (well)?", "Check linking verbs"],
            "bad_badly": ["Is it modifying a noun (bad)?", "Is it modifying a verb (badly)?", "Consider the context"],
            "double_negatives": ["Find all negative words", "Keep only one negative", "Change others to positive"],
            "tense": ["Identify time markers", "Match verb to time", "Check consistency"],
            "usage_common": ["Think about word meanings", "Check commonly confused pairs", "Consider context"],
            "appositives": ["Is it essential information?", "One or many?", "Check comma placement"],
            "prepositional_phrases": ["Check preposition choice", "Verify phrase placement", "Avoid ambiguity"]
        }
        
        hints = hint_map.get(error_type, ["Check grammar rules", "Read carefully", "Consider the context"])

        question_hash = self._generate_hash(question_text + str(config.grade) + error_type, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=hints,
            question_hash=question_hash
        )

    def _generate_vocabulary_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate vocabulary questions."""
        
        grade_words = self.vocabulary_banks.get(config.grade, self.vocabulary_banks[6])["words"]
        target_word = random.choice(grade_words)
        
        # Create context sentence
        contexts = {
            "adventure": "The brave explorer embarked on an exciting _____ through the unknown territory.",
            "mysterious": "The old mansion had a _____ atmosphere that made everyone curious.",
            "courage": "It takes great _____ to stand up for what you believe in.",
            "significant": "The scientist made a _____ discovery that changed our understanding.",
            "analyze": "Students must carefully _____ the data before drawing conclusions.",
            "sophisticated": "The new technology uses a very _____ system of sensors.",
            "phenomenon": "The northern lights are a natural _____ that amazes observers."
        }
        
        context = contexts.get(target_word, f"The word _____ best completes this sentence about learning.")
        question_text = f"Choose the word that best completes the sentence:\n\n{context}"
        
        # Generate options
        other_words = [w for w in grade_words if w != target_word]
        wrong_options = random.sample(other_words, 3)
        options = [target_word] + wrong_options
        random.shuffle(options)
        
        correct_answer = target_word
        explanation = f"'{target_word}' fits the context and meaning of the sentence."

        question_hash = self._generate_hash(question_text, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=["Consider the context of the sentence", "Think about which word makes the most sense"],
            question_hash=question_hash
        )

    def _generate_synonym_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate synonym questions."""
        
        grade_synonyms = self.vocabulary_banks.get(config.grade, self.vocabulary_banks[6])["synonyms"]
        word = random.choice(list(grade_synonyms.keys()))
        synonyms = grade_synonyms[word]
        correct_synonym = synonyms[0]
        
        question_text = f"Which word is a synonym for '{word}'?"
        
        # Generate wrong options from other synonym groups
        other_synonyms = []
        for other_word, other_syns in grade_synonyms.items():
            if other_word != word:
                other_synonyms.extend(other_syns)
        
        wrong_options = random.sample(other_synonyms, 3)
        options = [correct_synonym] + wrong_options
        random.shuffle(options)
        
        correct_answer = correct_synonym
        explanation = f"'{correct_synonym}' has the same meaning as '{word}'."

        question_hash = self._generate_hash(question_text, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=["Look for words with similar meanings", "Eliminate words that mean the opposite"],
            question_hash=question_hash
        )

    def _generate_antonym_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate antonym questions."""
        
        grade_antonyms = self.vocabulary_banks.get(config.grade, self.vocabulary_banks[6])["antonyms"]
        word = random.choice(list(grade_antonyms.keys()))
        correct_antonym = grade_antonyms[word]
        
        question_text = f"Which word is an antonym for '{word}'?"
        
        # Generate wrong options from other words in the antonym set
        other_words = [w for w in grade_antonyms.keys() if w != word]
        other_antonyms = [grade_antonyms[w] for w in other_words]
        
        wrong_options = random.sample(other_words + other_antonyms, 3)
        options = [correct_antonym] + wrong_options
        random.shuffle(options)
        
        correct_answer = correct_antonym
        explanation = f"'{correct_antonym}' means the opposite of '{word}'."

        question_hash = self._generate_hash(question_text, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=["Look for words with opposite meanings", "Think about contrasting ideas"],
            question_hash=question_hash
        )

    def _generate_sentence_completion_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate sentence completion questions."""
        
        sentence_templates = [
            "The scientist decided to _____ the experiment because the results were unclear.",
            "After studying for weeks, Maria felt _____ about taking the final exam.",
            "The new policy will _____ affect how students submit their assignments.",
            "Despite the challenges, the team remained _____ throughout the project.",
            "The teacher asked students to _____ their work before submitting it."
        ]
        
        answer_sets = [
            ["repeat", "ignore", "publish", "forget"],
            ["confident", "worried", "confused", "angry"],
            ["significantly", "barely", "never", "possibly"],
            ["determined", "discouraged", "lazy", "distracted"],
            ["review", "discard", "hide", "lose"]
        ]
        
        template_index = random.randint(0, len(sentence_templates) - 1)
        question_text = sentence_templates[template_index]
        answers = answer_sets[template_index]
        
        correct_answer = answers[0]
        options = answers
        random.shuffle(options)
        
        explanation = f"'{correct_answer}' best completes the sentence based on context and logic."

        question_hash = self._generate_hash(question_text, config)
        
        return GeneratedQuestion(
            question_text=question_text,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=["Consider the context of the sentence", "Think about what makes logical sense"],
            question_hash=question_hash
        )

    def _generate_comprehension_question(self, config: QuestionConfig) -> GeneratedQuestion:
        """Generate reading comprehension questions with COPPA-compliant content."""
        
        # Get appropriate passage based on mood and grade with robust fallbacks
        mood_templates = self.comprehension_templates.get(config.mood, self.comprehension_templates["curious"])
        
        # Try the exact grade first, then fallback to nearest available grade
        grade_templates = None
        for fallback_grade in [config.grade, 6, 7, 5, 8]:
            if fallback_grade in mood_templates:
                grade_templates = mood_templates[fallback_grade]
                break
        
        # If still no templates, use curious mood as ultimate fallback
        if not grade_templates or len(grade_templates) == 0:
            for fallback_grade in [6, 7, 5, 8]:
                if fallback_grade in self.comprehension_templates["curious"]:
                    grade_templates = self.comprehension_templates["curious"][fallback_grade]
                    break
        
        # Final safety check
        if not grade_templates or len(grade_templates) == 0:
            # Create a simple default passage
            grade_templates = {
                "learning": "Learning new skills takes practice and patience. Students who work hard often see improvement over time. Teachers help guide students through challenging concepts. With effort and determination, most people can master difficult subjects. Education opens doors to many opportunities in life."
            }
        
        # Select passage topic based on mood
        topic_key = random.choice(list(grade_templates.keys()))
        passage = grade_templates[topic_key]
        
        # Generate questions based on difficulty and grade
        if config.difficulty <= 5:
            # Basic comprehension questions
            question_types = [
                ("main_idea", "What is the main idea of this passage?"),
                ("detail", "According to the passage, what is one important detail?"),
                ("vocabulary", "In this passage, what does the word '{}' most likely mean?")
            ]
        elif config.difficulty <= 7:
            # Intermediate questions
            question_types = [
                ("inference", "What can you infer from this passage?"),
                ("purpose", "What is the author's main purpose in writing this passage?"),
                ("cause_effect", "According to the passage, what relationship is described?")
            ]
        else:
            # Advanced questions
            question_types = [
                ("analysis", "How does the author develop the main theme?"),
                ("tone", "What is the overall tone of this passage?"),
                ("organization", "How is this passage organized?")
            ]
        
        question_type, question_stem = random.choice(question_types)
        
        # Generate specific questions and answers based on type
        if question_type == "main_idea":
            if "gaming" in topic_key:
                correct_answer = "The development and importance of gaming skills and creativity"
                options = [
                    correct_answer,
                    "The history of video game technology",
                    "The dangers of excessive gaming",
                    "The cost of modern gaming equipment"
                ]
            elif "music" in topic_key:
                correct_answer = "The relationship between music, creativity, and learning"
                options = [
                    correct_answer,
                    "The technical requirements for music production",
                    "The history of classical music",
                    "The business aspects of the music industry"
                ]
            elif "science" in topic_key or "technology" in topic_key:
                correct_answer = "Scientific or technological discoveries and their significance"
                options = [
                    correct_answer,
                    "The challenges facing modern researchers",
                    "The cost of scientific equipment",
                    "The history of scientific methods"
                ]
            else:
                correct_answer = "The positive benefits and learning opportunities described"
                options = [
                    correct_answer,
                    "The challenges and difficulties mentioned",
                    "The historical background provided",
                    "The technical details explained"
                ]
            
            explanation = f"The passage focuses on {correct_answer.lower()}, which is the central theme throughout."
            
        elif question_type == "detail":
            # Extract specific details from passages
            if "mathematical" in passage or "patterns" in passage:
                correct_answer = "Mathematics and patterns are important elements"
                options = [
                    correct_answer,
                    "Technology is completely replacing traditional methods",
                    "Only experts can understand these concepts",
                    "These skills are only useful in school"
                ]
            elif "teamwork" in passage or "collaboration" in passage:
                correct_answer = "Collaboration and teamwork are emphasized"
                options = [
                    correct_answer,
                    "Individual work is always preferred",
                    "Competition is the only motivation",
                    "Social skills are not important"
                ]
            else:
                correct_answer = "Learning and skill development are highlighted"
                options = [
                    correct_answer,
                    "Natural talent is the only factor for success",
                    "Practice and effort are unnecessary",
                    "Age determines all abilities"
                ]
            
            explanation = f"The passage specifically mentions that {correct_answer.lower()}."
            
        elif question_type == "inference":
            correct_answer = "These activities can help develop important life skills"
            options = [
                correct_answer,
                "These activities are only for entertainment",
                "Success requires expensive equipment",
                "Only certain people can benefit from these activities"
            ]
            explanation = "The passage suggests that these activities provide learning and development opportunities."
            
        elif question_type == "vocabulary":
            # Select a key word from the passage
            key_words = ["sophisticated", "innovative", "collaborative", "analytical", "creative"]
            word = random.choice([w for w in key_words if w in passage])
            if not word:
                word = "develops"
            
            question_stem = f"In this passage, what does the word '{word}' most likely mean?"
            
            if word == "sophisticated":
                correct_answer = "Complex and advanced"
                options = [correct_answer, "Simple and basic", "Expensive and costly", "Old and traditional"]
            elif word == "innovative":
                correct_answer = "Creative and new"
                options = [correct_answer, "Traditional and old", "Difficult and hard", "Popular and common"]
            else:
                correct_answer = "Grows and improves"
                options = [correct_answer, "Stays the same", "Becomes worse", "Disappears completely"]
            
            explanation = f"Based on the context, '{word}' means {correct_answer.lower()}."
        
        else:  # Advanced questions
            if question_type == "tone":
                correct_answer = "Positive and encouraging"
                options = [
                    correct_answer,
                    "Critical and negative",
                    "Neutral and factual only",
                    "Worried and concerned"
                ]
                explanation = "The passage presents information in an encouraging and positive manner."
            
            elif question_type == "purpose":
                correct_answer = "To inform and inspire readers about learning opportunities"
                options = [
                    correct_answer,
                    "To warn readers about potential dangers",
                    "To sell products or services",
                    "To criticize current educational methods"
                ]
                explanation = "The author's main goal is to educate and encourage readers."
            
            else:  # organization
                correct_answer = "Information is presented with examples and explanations"
                options = [
                    correct_answer,
                    "Ideas are presented in chronological order only",
                    "The passage uses only questions and answers",
                    "Information is presented as a debate"
                ]
                explanation = "The passage is organized to provide clear information with supporting examples."
        
        # Combine passage and question
        full_question = f"Read the following passage:\n\n{passage}\n\n{question_stem}"
        
        question_hash = self._generate_hash(full_question, config)
        
        return GeneratedQuestion(
            question_text=full_question,
            question_type="multiple_choice",
            correct_answer=correct_answer,
            options=options,
            explanation=explanation,
            hints=["Read the passage carefully", "Look for key information that answers the question", "Eliminate obviously wrong answers"],
            question_hash=question_hash
        )

    # Helper methods
    def _prime_factorization(self, n):
        """Return prime factorization of n."""
        factors = []
        d = 2
        while d * d <= n:
            while n % d == 0:
                factors.append(d)
                n //= d
            d += 1
        if n > 1:
            factors.append(n)
        return factors

    def _gcd(self, a, b):
        """Calculate greatest common divisor."""
        while b:
            a, b = b, a % b
        return a

    def _create_grammar_distractor(self, correct_sentence, distractor_type):
        """Create a grammatically incorrect distractor."""
        if distractor_type == 1:
            # Simple word substitution
            return correct_sentence.replace("is", "are").replace("are", "is")
        else:
            # Different substitution
            return correct_sentence.replace("has", "have").replace("have", "has")

    def _generate_hash(self, question_text: str, config: QuestionConfig) -> str:
        """Generate unique hash for question."""
        content = f"{question_text}_{config.topic}_{config.grade}_{config.difficulty}_{config.mood}"
        return hashlib.md5(content.encode()).hexdigest()

class SupabasePopulator:
    def __init__(self, supabase_url: str, supabase_key: str):
        """Initialize Supabase client."""
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.generator = QuestionGenerator()

    def generate_and_populate(self, 
                            topics: List[str], 
                            grades: List[int], 
                            difficulties: List[int],
                            moods: List[str],
                            questions_per_config: int = 10,
                            batch_size: int = 100,
                            check_duplicates: bool = True):
        """Generate questions and populate database with duplicate prevention."""
        
        total_questions = 0
        successful_inserts = 0
        duplicate_count = 0
        errors = []
        
        logger.info(f"Starting question generation for {len(topics)} topics, {len(grades)} grades, {len(difficulties)} difficulties")
        
        # Get existing question hashes if duplicate checking is enabled
        existing_hashes = set()
        if check_duplicates:
            try:
                logger.info("Fetching existing question hashes to prevent duplicates...")
                result = self.supabase.table("question_cache").select("question_hash").execute()
                existing_hashes = {row['question_hash'] for row in result.data if row['question_hash']}
                logger.info(f"Found {len(existing_hashes)} existing questions in database")
            except Exception as e:
                logger.warning(f"Could not fetch existing hashes: {str(e)}. Proceeding without duplicate check.")
                check_duplicates = False
        
        # Generate all configurations
        configs = []
        for topic in topics:
            for grade in grades:
                for difficulty in difficulties:
                    for mood in moods:
                        config = QuestionConfig(
                            topic=topic,
                            grade=grade,
                            difficulty=difficulty,
                            mood=mood
                        )
                        configs.append(config)
        
        # Generate questions in batches
        all_questions = []
        for config in configs:
            try:
                for _ in range(questions_per_config):
                    question = self.generator.generate_question(config)
                    
                    # Check for duplicates if enabled
                    if check_duplicates and question.question_hash in existing_hashes:
                        duplicate_count += 1
                        continue  # Skip this duplicate question
                    
                    all_questions.append((question, config))
                    total_questions += 1
                    
                    # Add to existing hashes to prevent duplicates within this session
                    if check_duplicates:
                        existing_hashes.add(question.question_hash)
                        
            except Exception as e:
                logger.error(f"Error generating question for {config.topic}, grade {config.grade}: {str(e)}")
                errors.append(f"Generation error: {str(e)}")
        
        logger.info(f"Generated {len(all_questions)} unique questions (skipped {duplicate_count} duplicates), preparing for database insertion")
        
        # Insert in batches
        for i in range(0, len(all_questions), batch_size):
            batch = all_questions[i:i + batch_size]
            try:
                batch_data = []
                for question, config in batch:
                    # Convert to database format
                    question_json = {
                        "question_text": question.question_text,
                        "question_type": question.question_type,
                        "correct_answer": question.correct_answer,
                        "options": question.options,
                        "explanation": question.explanation,
                        "hints": question.hints
                    }
                    
                    db_record = {
                        "topic": config.topic,
                        "difficulty": config.difficulty,
                        "grade": config.grade,
                        "question": question_json,
                        "ai_model": config.ai_model,
                        "expires_at": None,  # Permanent questions
                        "answer_explanation": question.explanation,
                        "mood": config.mood,
                        "question_hash": question.question_hash
                    }
                    batch_data.append(db_record)
                
                # Insert batch with conflict handling
                try:
                    result = self.supabase.table("question_cache").insert(batch_data).execute()
                    successful_inserts += len(batch_data)
                    logger.info(f"Inserted batch {i//batch_size + 1}: {len(batch_data)} questions")
                except Exception as e:
                    # Handle potential hash conflicts
                    if "duplicate key value violates unique constraint" in str(e).lower() or "question_hash" in str(e).lower():
                        logger.info(f"Batch {i//batch_size + 1} contained duplicates, inserting individually...")
                        individual_inserts = 0
                        for record in batch_data:
                            try:
                                self.supabase.table("question_cache").insert([record]).execute()
                                individual_inserts += 1
                            except Exception as individual_error:
                                if "duplicate" in str(individual_error).lower():
                                    duplicate_count += 1
                                else:
                                    logger.error(f"Individual insert error: {str(individual_error)}")
                        successful_inserts += individual_inserts
                        logger.info(f"Batch {i//batch_size + 1}: {individual_inserts} inserted individually")
                    else:
                        raise e
                
            except Exception as e:
                logger.error(f"Error inserting batch {i//batch_size + 1}: {str(e)}")
                errors.append(f"Batch {i//batch_size + 1} insertion error: {str(e)}")
        
        # Summary
        logger.info(f"""
        Population Summary:
        - Total questions generated: {total_questions}
        - Successfully inserted: {successful_inserts}
        - Duplicates skipped: {duplicate_count}
        - Errors: {len(errors)}
        """)
        
        if errors:
            logger.error("Errors encountered:")
            for error in errors[:10]:  # Show first 10 errors
                logger.error(f"  - {error}")
        
        return {
            "total_generated": total_questions,
            "successful_inserts": successful_inserts,
            "duplicates_skipped": duplicate_count,
            "errors": errors
        }

def main():
    """Main execution function."""
    
    # Get Supabase credentials from environment variables
    # Try both with and without NEXT_PUBLIC_ prefix
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        logger.error("Missing Supabase credentials. Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.")
        return
    
    # Initialize populator
    populator = SupabasePopulator(supabase_url, supabase_key)
    
    # Define what to generate
    topics = [
        "math_algebra",
        "math_geometry", 
        "math_number_theory",
        "math_statistics",
        "english_grammar",
        "english_vocabulary",
        "english_synonyms",
        "english_antonyms",
        "english_sentences",
        "english_comprehension"
    ]
    
    grades = [5, 6, 7, 8, 9, 10, 11]
    difficulties = [5, 6, 7, 8, 9]  # Starting at 5 as requested
    moods = ["creative", "relaxed", "curious", "adventurous", "analytical", "practical", "competitive", "cool"]
    
    # Generate and populate
    result = populator.generate_and_populate(
        topics=topics,
        grades=grades,
        difficulties=difficulties,
        moods=moods,
        questions_per_config=5,  # 5 questions per combination
        batch_size=50,
        check_duplicates=True  # Enable duplicate prevention
    )
    
    logger.info(f"Population completed: {result}")

if __name__ == "__main__":
    main()