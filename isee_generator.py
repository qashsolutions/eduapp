import os
import json
import hashlib
import random
import re
import requests
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

# Initialize clients
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Constants for duplicate detection
FUZZY_SIMILARITY_THRESHOLD = 0.85  # 85% similarity triggers duplicate detection
MIN_PASSAGE_LENGTH = 200  # Minimum words for meaningful comparison
MAX_RETRIES_PER_TOPIC = 5  # Maximum attempts before skipping topic

# Grammar textbook source (using predefined passages since original URLs don't work)
USE_PREDEFINED_PASSAGES = True

# Grammar concepts mapping from table of contents
GRAMMAR_CONCEPTS_MAPPING = {
    # Unit 1 - Subjects, Predicates, and Sentences
    "1.1": "declarative_interrogative_sentences",
    "1.2": "exclamatory_imperative_sentences", 
    "1.3": "subjects_predicates",
    "1.4": "compound_subjects_predicates",
    "1.5": "sentence_fragments",
    "1.6": "simple_compound_sentences",
    
    # Unit 2 - Nouns
    "2.7": "proper_common_nouns",
    "2.8": "concrete_abstract_collective_nouns",
    "2.9": "compound_possessive_nouns",
    "2.10": "plural_possessive_contractions",
    "2.11": "appositives",
    
    # Unit 3 - Verbs
    "3.12": "action_verbs",
    "3.13": "transitive_intransitive_verbs",
    "3.14": "indirect_objects_predicate_words",
    "3.15": "linking_verbs_predicate_words",
    "3.16": "verb_tenses_present_past_future",
    "3.17": "main_helping_verbs",
    "3.18": "progressive_forms",
    "3.19": "perfect_tenses",
    "3.20": "irregular_verbs_1",
    "3.21": "irregular_verbs_2",
    
    # Unit 4 - Pronouns
    "4.22": "personal_pronouns",
    "4.23": "pronouns_antecedents",
    "4.24": "pronoun_usage",
    "4.25": "possessive_indefinite_pronouns",
    "4.26": "reflexive_intensive_pronouns",
    "4.27": "interrogative_pronouns",
    
    # Unit 5 - Adjectives and Adverbs
    "5.28": "adjectives",
    "5.30": "comparative_superlative_adjectives",
    "5.31": "more_comparative_superlative_adjectives",
    "5.32": "demonstratives",
    "5.33": "adverbs",
    "5.34": "intensifiers",
    "5.35": "comparative_superlative_adverbs",
    "5.36": "adverbs_adjectives_usage",
    "5.37": "avoiding_double_negatives",
    
    # Unit 6 - Prepositions, Conjunctions, and Interjections
    "6.38": "prepositions_prepositional_phrases",
    "6.39": "pronouns_objects_prepositions",
    "6.40": "prepositional_phrases_adjectives_adverbs",
    "6.41": "conjunctions_interjections",
    
    # Unit 7 - Clauses and Complex Sentences
    "7.42": "simple_compound_sentences_main_clauses",
    "7.43": "complex_sentences_subordinate_clauses",
    "7.44": "adjective_clauses",
    "7.45": "adverb_clauses",
    "7.46": "noun_clauses",
    
    # Unit 8 - Verbals
    "8.47": "participles_participial_phrases",
    "8.48": "gerunds_gerund_phrases",
    "8.49": "infinitives_infinitive_phrases",
    
    # Unit 9 - Subject-Verb Agreement
    "9.50": "subject_verb_agreement",
    "9.51": "locating_subject",
    "9.52": "collective_nouns_special_subjects",
    "9.53": "indefinite_pronouns_subjects",
    "9.54": "compound_subjects_agreement",
    
    # Unit 10 - Diagramming Sentences
    "10.55": "diagramming_simple_subjects"
}

# Grammar concepts by complexity for grade assignment
SIMPLE_GRAMMAR = [
    "declarative_interrogative_sentences", "exclamatory_imperative_sentences",
    "subjects_predicates", "proper_common_nouns", "action_verbs", 
    "personal_pronouns", "adjectives", "adverbs", "prepositions_prepositional_phrases"
]

MEDIUM_GRAMMAR = [
    "compound_subjects_predicates", "sentence_fragments", "simple_compound_sentences",
    "concrete_abstract_collective_nouns", "transitive_intransitive_verbs", 
    "verb_tenses_present_past_future", "comparative_superlative_adjectives",
    "subject_verb_agreement", "conjunctions_interjections"
]

COMPLEX_GRAMMAR = [
    "compound_possessive_nouns", "linking_verbs_predicate_words", "perfect_tenses",
    "reflexive_intensive_pronouns", "complex_sentences_subordinate_clauses",
    "adjective_clauses", "adverb_clauses", "participles_participial_phrases",
    "gerunds_gerund_phrases", "infinitives_infinitive_phrases"
]

# Predefined grammar passages for each concept
GRAMMAR_PASSAGES = {
    "declarative_interrogative_sentences": """
    The young scientist carefully observed the chemical reaction in her laboratory. She had spent months preparing for this crucial experiment, which could revolutionize our understanding of renewable energy. Every measurement needed to be precise. Would her hypothesis prove correct? Her colleagues watched anxiously as she recorded each data point. The results would determine the future of their research grant. Did the solution change color as predicted? She checked her notes repeatedly. The temperature readings were critical to the experiment's success. How long would the reaction take to complete? Previous trials had shown inconsistent results, but today felt different. The laboratory buzzed with anticipation as everyone waited for the final outcome. Would this be the breakthrough they had been seeking? Time seemed to slow as the reaction progressed. She maintained her focus despite the pressure. Her years of training had prepared her for this moment. The scientific community eagerly awaited their findings.
    """,
    
    "exclamatory_imperative_sentences": """
    Listen carefully to these important instructions! First, gather all your materials before beginning the project. What an incredible opportunity this presents for learning! Never skip the safety procedures when working in the laboratory. Check each measurement twice to ensure accuracy. How amazing that such simple steps can lead to profound discoveries! Remember to document every observation in your notebook. Don't forget to wear protective equipment at all times. What a difference proper preparation makes! Clean your workspace thoroughly after completing each phase. Pay attention to even the smallest details during the experiment. Incredible results often come from meticulous work! Share your findings with your team members immediately. Always double-check your calculations before proceeding. Such dedication will surely lead to success! Review the protocol one more time before starting. Take pride in your scientific methodology!
    """,
    
    "subjects_predicates": """
    The ancient oak tree stood majestically in the center of the village square. Its gnarled branches provided shade for generations of townspeople. Children played beneath its protective canopy every summer afternoon. The tree witnessed countless historical events over three centuries. Local historians documented its significance to the community. Birds nested in its hollow trunk each spring. The town council declared it a protected landmark last year. Residents gathered around it for annual festivals and celebrations. Strong winds occasionally broke its smaller branches. The groundskeeper carefully tended to its health. Lightning struck it once but failed to destroy its spirit. Artists frequently painted its impressive silhouette against sunset skies. The tree's roots extended deep beneath the cobblestone streets. Tourists photographed it from every possible angle. Its leaves turned brilliant gold each autumn. The mayor's office received numerous letters praising its preservation. This living monument connected past and present beautifully. Everyone in town cherished their remarkable tree.
    """,
    
    "compound_subjects_predicates": """
    Maria and her brother organized and executed the neighborhood cleanup campaign. The students and teachers planned and prepared the annual science fair together. Dogs and cats often compete for attention but usually coexist peacefully in homes. The chef and his assistant chopped vegetables and prepared sauces for the evening service. Wind and rain battered the coastline and flooded the nearby streets. Scientists and researchers analyzed data and published their groundbreaking findings. The pianist and violinist rehearsed and performed the challenging duet flawlessly. Parents and children laughed and played at the community picnic. The director and producer reviewed scripts and selected the perfect cast. Doctors and nurses worked tirelessly and saved countless lives during the crisis. The author and illustrator collaborated and created a bestselling children's book. Thunder and lightning frightened the animals and disrupted the outdoor concert. The coach and players practiced drills and developed new strategies. Artists and musicians gathered and celebrated at the cultural festival. The baker and decorator designed and crafted elaborate wedding cakes. Volunteers and organizers distributed supplies and comforted disaster victims.
    """,
    
    "sentence_fragments": """
    The workshop focused on identifying and correcting incomplete thoughts in writing. Running through the park on a sunny morning. This fragment lacks a complete predicate. The students learned to recognize when sentences were missing essential components. Because the weather was perfect for outdoor activities. This subordinate clause cannot stand alone. Writers often create fragments accidentally when they punctuate dependent clauses as sentences. Although everyone had studied diligently for the exam. Another example of an incomplete thought. The teacher explained that every sentence needs both a subject and a predicate. Walking along the beach at sunset. This phrase describes an action but lacks a subject. Students practiced combining fragments with independent clauses to create complete sentences. After the long winter finally ended. This temporal phrase needs a main clause. The editing process involves searching for these incomplete constructions. Which was exactly what they had hoped to find. Relative clauses also create fragments when isolated. Through careful revision, writers can eliminate fragments from their work. During the most important game of the season. Prepositional phrases alone don't form complete sentences.
    """,
    
    "simple_compound_sentences": """
    The library opened early, and students rushed to claim their favorite study spots. Simple sentences contain one independent clause. The professor explained the concept clearly. Compound sentences join two independent clauses with coordinating conjunctions. The experiment failed, but the researchers learned valuable lessons. Some students prefer simple sentences for clarity. The sun set behind the mountains. Others enjoy compound sentences for their rhythm and flow. The musician practiced daily, yet she still felt nervous before performances. Simple sentences can be powerful and direct. The storm approached rapidly. Compound sentences allow writers to show relationships between ideas. The children played in the yard, and their parents watched from the porch. Each sentence type serves a specific purpose in effective writing. The artist painted landscapes. The gallery displayed her work, and collectors eagerly purchased pieces. Writers must choose the appropriate structure for their message. The technique requires practice. Students improved their writing skills, so their grades increased significantly.
    """,
    
    "proper_common_nouns": """
    The Smithsonian Museum in Washington attracts millions of visitors annually. Common nouns like museums can be found in every major city. Dr. Elizabeth Chen pioneered research at Stanford University. Universities worldwide benefit from dedicated professors and researchers. The Amazon River flows through several South American countries. Rivers provide essential water resources for countless communities. Shakespeare wrote magnificent plays during the Elizabethan Era. Playwrights throughout history have entertained and educated audiences. Mount Everest challenges climbers with its extreme altitude and weather. Mountains create diverse ecosystems and influence regional climates. President Lincoln delivered the Gettysburg Address during the Civil War. Leaders shape nations through their decisions and speeches. The Pacific Ocean covers more area than all land masses combined. Oceans regulate global temperatures and support marine life. Leonardo da Vinci painted the Mona Lisa during the Renaissance. Artists express cultural values and human experiences through their work. The Great Wall of China stretches across northern China. Walls have historically served as boundaries and defensive structures.
    """,
    
    "concrete_abstract_collective_nouns": """
    The orchestra performed brilliantly, demonstrating perfect harmony and teamwork. Concrete nouns like violin and piano filled the concert hall with beautiful sounds. The audience expressed their appreciation through thunderous applause. Abstract concepts like justice and freedom inspire people to take action. The committee reached a unanimous decision after hours of deliberation. A flock of geese flew overhead in perfect formation. Happiness spread through the crowd as the team scored the winning goal. The jury carefully considered all evidence before reaching their verdict. Books lined the shelves while knowledge filled eager minds. The herd moved slowly across the vast plains searching for water. Courage enabled the young activist to speak before the assembly. The faculty announced new policies to improve student success. Tables and chairs furnished the room while comfort and hospitality welcomed guests. The tribe preserved their traditions through storytelling and ceremonies. Love and compassion motivated volunteers to help flood victims. The fleet sailed into the harbor as pride swelled in the sailors' hearts.
    """,
    
    "action_verbs": """
    Maria sprinted across the soccer field, dodging defenders with remarkable agility. She kicked the ball with tremendous force toward the goal. Her teammates cheered enthusiastically from the sidelines. The goalkeeper dove desperately to block her shot. The ball soared through the air and struck the goalpost. Maria recovered quickly and seized the rebound opportunity. She maneuvered around two opposing players skillfully. The crowd roared with excitement as she approached the goal again. Her coach shouted strategic instructions from the bench. Maria faked left, then pivoted sharply to the right. The defender stumbled and lost her balance completely. With seconds remaining, Maria launched the ball toward the net. It curved beautifully through the air. The goalkeeper jumped but missed by inches. The ball crashed into the back of the net. Maria's teammates rushed onto the field to celebrate. They lifted her onto their shoulders triumphantly. The victory secured their place in the championship finals.
    """,
    
    "transitive_intransitive_verbs": """
    The chef prepared an elaborate meal for the guests. The word 'prepared' is transitive, requiring the direct object 'meal.' The guests arrived promptly at seven o'clock. 'Arrived' functions as an intransitive verb, complete without an object. Sarah wrote detailed notes during the lecture. The transitive verb 'wrote' acts upon the object 'notes.' The flowers bloomed magnificently in the garden. 'Bloomed' stands alone as an intransitive verb. The students studied their assignments diligently. 'Studied' takes 'assignments' as its direct object. The children laughed joyfully at the puppet show. The intransitive verb 'laughed' needs no object to complete its meaning. The artist painted vibrant landscapes of the countryside. 'Painted' requires the object 'landscapes' to express complete meaning. The storm raged throughout the night. 'Raged' functions intransitively, expressing complete action independently. The teacher explained the complex concept clearly. The transitive verb 'explained' acts upon 'concept.' The audience applauded enthusiastically after the performance. 'Applauded' can function both transitively and intransitively.
    """,
    
    "linking_verbs_predicate_words": """
    The sunset appeared magnificent across the ocean horizon. The linking verb 'appeared' connects the subject to its description. Sarah became a renowned scientist after years of research. 'Became' links Sarah to her professional identity. The soup tastes delicious with fresh herbs and spices. Sensory verbs like 'tastes' often function as linking verbs. The students remained focused despite numerous distractions. 'Remained' connects students to their state of concentration. The garden looks beautiful in the early morning light. 'Looks' links the garden to its aesthetic quality. The weather turned cold suddenly last evening. 'Turned' connects weather to its changed condition. The children seemed happy with their test results. 'Seemed' suggests an apparent state or condition. The proposal sounds reasonable to all committee members. 'Sounds' functions as a linking verb with auditory perception. The athlete felt confident before the championship game. 'Felt' links the athlete to an emotional state. The theory proved accurate through extensive experimentation. 'Proved' connects the theory to its verified status.
    """,
    
    "verb_tenses_present_past_future": """
    The Thompson family planned their summer vacation carefully every year. Last summer, they visited Yellowstone National Park and explored its many wonders. They hiked through forests, watched geysers erupt, and photographed wildlife. This year, they are traveling to the Grand Canyon for a different adventure. They wake up early each morning to avoid the desert heat. Tomorrow, they will take a helicopter tour over the canyon. Next week, they will raft down the Colorado River. Their children studied geology before the trip began. They learned about rock formations millions of years old. The park ranger explained how the canyon formed over time. Water carved through layers of rock for countless centuries. The family observes different colors in the canyon walls. Each layer represents a different geological era. They will remember this educational experience forever. Their photos captured breathtaking views from various lookout points. The sunset painted the canyon in brilliant shades. They enjoyed every moment of their journey. Future generations will appreciate these natural wonders too. The Thompsons already plan their next adventure for next summer.
    """,
    
    "perfect_tenses": """
    By the time the concert began, the orchestra had practiced for six months. The musicians have perfected every note through dedicated rehearsal. They will have performed this symphony fifty times by year's end. The conductor had studied the score extensively before the first rehearsal. Each section has contributed unique talents to the ensemble. The violinists had mastered the challenging passages through repetition. The audience has appreciated their efforts with standing ovations. By next season, they will have recorded three albums together. The percussion section had arrived early to set up their instruments. The woodwinds have blended beautifully throughout the performance. The brass section had overcome initial timing difficulties. Critics have praised their interpretation of classical works. The orchestra will have toured internationally by next summer. The pianist had memorized the entire concerto weeks ago. They have achieved remarkable success in just two years. The ensemble had developed exceptional chemistry through collaboration. Supporters have donated generously to sustain the program. The musicians will have inspired countless young artists.
    """,
    
    "personal_pronouns": """
    When Sarah discovered the old diary in her grandmother's attic, she couldn't believe what she was reading. It belonged to her great-great-grandmother, who had lived through the Civil War. She had written about her experiences helping wounded soldiers. They came to her farmhouse seeking food and shelter. She never turned them away, regardless of which side they fought for. Her compassion touched everyone who met her. He was a young Confederate soldier who arrived one stormy night. His injuries were severe, but she nursed him back to health. They developed a deep friendship despite their different backgrounds. She taught him to read using her precious books. He helped her with farm chores as he recovered. Their correspondence continued for years after the war ended. She kept all his letters in a wooden box. He eventually became a teacher in his hometown. They never met again, but their friendship endured through their writings. She passed down these stories to her children. They treasured them as family history. We can learn much from their example of humanity during difficult times.
    """,
    
    "possessive_indefinite_pronouns": """
    Everyone's contribution made the charity event successful beyond anyone's expectations. Someone left their umbrella in the conference room yesterday. Nobody's perfect, but everybody's effort counts toward achieving our goals. Each student must submit his or her assignment by Friday. Neither's argument convinced the judge during the trial. One's perspective shapes how one interprets events. Anybody's guess was as good as mine regarding the outcome. Several's attempts failed before someone's finally succeeded. All's well that ends well, as somebody's grandmother used to say. Everything's place was clearly marked in the diagram. No one's suggestion was rejected without careful consideration. Both's performances exceeded the director's expectations. Many's dreams became reality through hard work and determination. Few's accomplishments matched hers in the field of science. Others' opinions mattered greatly in the decision-making process. Someone's keys were found in the library yesterday. Everyone's participation is essential for the project's success. Neither's proposal addressed all the committee's concerns adequately.
    """,
    
    "reflexive_intensive_pronouns": """
    The students themselves organized the entire science fair without adult supervision. Sarah taught herself advanced calculus using online resources. The president himself attended the groundbreaking ceremony. We ourselves must take responsibility for our community's future. The cat groomed itself methodically in the sunny window. They themselves admitted the error in their calculations. You yourself witnessed the extraordinary event last night. The machine itself requires minimal maintenance. I myself couldn't believe the test results. The children dressed themselves for the first time. The author herself appeared at the book signing. We prided ourselves on completing the project early. The team itself selected their new captain. You yourselves created this innovative solution. The building itself survived the earthquake intact. They convinced themselves that success was possible. She herself performed all the dangerous stunts. The committee itself reconsidered its previous decision.
    """,
    
    "adjectives": """
    The ancient manuscript revealed fascinating secrets about medieval life. Brilliant scientists made groundbreaking discoveries in the modern laboratory. The enormous telescope captured stunning images of distant galaxies. Talented musicians performed classical pieces with remarkable precision. The delicious aroma of fresh bread filled the cozy bakery. Courageous firefighters rescued frightened residents from the burning building. The mysterious package contained valuable artifacts from ancient civilizations. Energetic children played creative games in the spacious playground. The experienced teacher used innovative methods to engage reluctant learners. Beautiful butterflies danced among fragrant flowers in the peaceful garden. The determined athlete overcame significant obstacles to achieve outstanding success. Curious students asked thoughtful questions during the interesting lecture. The generous donor provided substantial funding for important research. Skilled artisans created exquisite jewelry using traditional techniques. The powerful storm brought torrential rain to the coastal region. Ambitious entrepreneurs developed revolutionary products for global markets. The comfortable library offered quiet spaces for serious study. Dedicated volunteers provided essential services to grateful recipients.
    """,
    
    "comparative_superlative_adjectives": """
    The science fair showcased projects ranging from simple experiments to the most complex innovations. Sarah's volcano model was larger than most entries, but not the largest overall. Her detailed explanation proved more comprehensive than her competitors' presentations. The judges found her research the most thorough among all eighth-grade participants. Tom's robotics project was more advanced than any previous year's entries. His robot moved faster and more precisely than the expensive commercial models. The youngest participant created a simpler but equally impressive solar panel design. Her innovation was more practical than many complicated submissions. The environmental science projects were more popular than traditional chemistry experiments. The messiest demonstration involved creating the biggest bubble possible. Students discovered that smaller groups worked more effectively than larger teams. The quietest presentation unexpectedly won the most creative award. The harder students worked, the better their results became. The most successful projects combined simpler concepts with clearer explanations. Parents found the elementary entries more charming than technically superior high school projects. The longest presentation wasn't necessarily the most informative. The judges declared this year's fair more competitive than ever before. The best projects demonstrated that younger students could tackle the most challenging scientific concepts.
    """,
    
    "adverbs": """
    The researcher carefully examined the data before drawing conclusions. Students enthusiastically participated in the interactive demonstration. The storm moved rapidly across the plains, bringing heavy rainfall. The chef skillfully prepared the elaborate meal for distinguished guests. Children laughed joyfully as they played in the newly fallen snow. The artist delicately applied paint to create subtle color variations. The athlete trained rigorously to prepare for the upcoming competition. The teacher patiently explained the concept until everyone understood clearly. The orchestra performed magnificently, earning thunderous applause. The detective methodically searched for clues at the crime scene. The flowers bloomed beautifully in the well-tended garden. The speaker confidently addressed the large audience without notes. The mechanic efficiently repaired the complex engine problem. The dancers moved gracefully across the stage in perfect synchronization. The scientist precisely measured each chemical before mixing. The volunteers worked tirelessly to help flood victims. The author eloquently expressed her thoughts on social justice. The students listened attentively during the fascinating presentation.
    """,
    
    "prepositions_prepositional_phrases": """
    Throughout the ancient castle, hidden passages connected rooms beneath the stone floors. During the Renaissance, artists worked within the patronage system of wealthy families. Behind the waterfall, explorers discovered a cave with prehistoric paintings on its walls. Among the scattered ruins, archaeologists found artifacts from a lost civilization. Between the mountain peaks, a narrow valley sheltered a remote village from harsh weather. Within the research facility, scientists conducted experiments under strict safety protocols. Across the desert landscape, caravans traveled along ancient trade routes for centuries. Through careful observation, naturalists documented animal behavior in their native habitats. Despite numerous obstacles, the expedition reached the summit before the storm arrived. Beyond the city limits, farmland stretched toward the distant mountains on the horizon. Inside the museum vault, priceless treasures remained under constant surveillance. Above the cloud layer, pilots navigated by the stars until modern instruments arrived. Alongside the riverbank, wildflowers bloomed throughout the spring months. Beneath the ocean surface, diverse ecosystems thrived around coral reefs. Without proper equipment, climbing above the tree line becomes extremely dangerous.
    """,
    
    "conjunctions_interjections": """
    The students studied diligently, for they wanted to excel on their exams. Wow! The experiment produced unexpected yet fascinating results. Neither the theory nor the hypothesis explained the unusual phenomenon. Oh my! The chemical reaction occurred faster than anyone anticipated. The researchers worked tirelessly, but they needed more time and resources. Alas! The ancient manuscript crumbled before they could finish translating. Both the professor and her assistant contributed equally to the discovery. Hooray! The team finally solved the equation after months of work. The data was accurate, so the conclusions were reliable and significant. Well! That certainly changes our understanding of the process. Either we modify our approach or we risk failure in the experiment. Bravo! Your presentation exceeded all expectations and impressed everyone. The storm approached rapidly, yet the outdoor event continued as planned. Good grief! The laboratory equipment malfunctioned at the worst possible moment. Not only did they complete the project but also exceeded the original goals. Eureka! The solution appeared when they least expected it.
    """,
    
    "simple_compound_sentences_main_clauses": """
    The library contains thousands of books. This simple sentence has one main clause. The students studied for hours, and they felt prepared for the test. This compound sentence joins two main clauses with a coordinating conjunction. Rain fell steadily throughout the night. Another simple sentence demonstrates complete thought. The concert began late, but the audience remained patient and enthusiastic. Two main clauses create this compound structure. Scientists discovered a new species. The main clause stands independently. The museum opened a new exhibit, so visitors flocked to see the artifacts. Coordinating conjunctions link related main clauses. Teachers prepared innovative lessons. Each main clause expresses one complete idea. The storm damaged several buildings, yet the community quickly organized repairs. Main clauses can show contrast through conjunctions. Children played in the park. Simple sentences focus on single actions. The artist painted all morning, and she sold three paintings that afternoon. Compound sentences show sequence and relationship. The volcano erupted suddenly. Main clauses form the foundation of clear writing. Researchers analyzed the data carefully, for accuracy was essential to their conclusions.
    """,
    
    "complex_sentences_subordinate_clauses": """
    Although the storm raged outside, the lighthouse keeper maintained his vigilant watch. Because ships depended on his beacon, he never abandoned his post during bad weather. While waves crashed against the rocky shore, he climbed the spiral stairs to check the light. Since the automated system had failed last month, he operated everything manually. The old lighthouse, which had stood for a century, remained structurally sound. Whenever fog rolled in from the sea, he sounded the foghorn at regular intervals. If a ship appeared to be in distress, he immediately radioed the coast guard. Even though modern GPS systems exist, sailors still relied on traditional lighthouses for navigation. The keeper wrote in his logbook while he waited through long, solitary nights. Unless the weather improved significantly, no supply boats could reach the island. After he completed his morning inspection, he prepared a simple breakfast. Because his family lived on the mainland, he cherished their weekly radio conversations. The lighthouse stood tall, as if it were challenging the fierce ocean storms. Until his replacement arrived next month, he would continue his essential duty.
    """,
    
    "adjective_clauses": """
    The museum, which opened last month, features artifacts from ancient civilizations. The curator, who studied archaeology at Oxford, carefully selected each piece. Visitors can see pottery that dates back three thousand years. The exhibition hall, where natural light illuminates the displays, creates a perfect atmosphere. The gold jewelry, which belonged to Egyptian royalty, attracts the most attention. Children especially enjoy the interactive section, where they can touch replica artifacts. The documentary, which plays continuously in the theater, explains archaeological methods. Experts who specialize in preservation techniques maintain the collection. The storage area, where temperature and humidity are strictly controlled, protects delicate items. The guidebook, which includes detailed photographs, helps visitors understand each artifact's significance. Security guards, who patrol constantly, ensure nothing is disturbed. The gift shop, where reproductions are sold, supports the museum's educational programs. Researchers who visit from universities worldwide study these treasures. The restoration laboratory, which uses advanced technology, repairs damaged pieces. School groups that tour regularly learn about ancient cultures firsthand. The museum's mission, which emphasizes education and preservation, benefits the entire community.
    """,
    
    "adverb_clauses": """
    Students practiced daily so that they would master the difficult techniques. Before the competition began, coaches gave final instructions to their teams. The orchestra rehearsed intensively because perfection was their goal. After the storm passed, volunteers assessed damage throughout the community. Teachers modified lesson plans whenever students struggled with concepts. Since technology advanced rapidly, schools updated their computer systems annually. The athlete trained harder than she ever had before. Although challenges arose frequently, the team maintained positive attitudes. The experiment proceeded as the scientists had carefully planned. While some doubted the theory, evidence supported its validity. The garden flourished wherever sunlight reached the plants. If weather permits tomorrow, the outdoor festival will proceed as scheduled. The artist worked until every detail satisfied her exacting standards. Once the foundation was established, construction progressed smoothly. The play continued even though technical difficulties occurred. Unless circumstances change dramatically, the project will finish on time. The river flowed where ancient glaciers had carved deep valleys. As time passed slowly, patience became their greatest virtue.
    """,
    
    "participles_participial_phrases": """
    Running through the forest, the deer escaped from pursuing predators. The broken window, discovered during morning inspection, required immediate repair. Exhausted from the long journey, travelers rested at the welcoming inn. The award-winning scientist, recognized globally, shared her research findings. Having completed their assignments early, students enjoyed extra recreational time. The stolen painting, missing for decades, surfaced at an auction house. Encouraged by initial success, the team pursued more ambitious goals. The falling leaves, painted in autumn colors, created a magnificent display. Having practiced for months, the musicians delivered a flawless performance. The excited children, anticipating the holiday celebration, could barely sleep. Damaged by the storm, the old barn required extensive repairs. The determined athlete, training despite injuries, inspired her teammates. Written in ancient script, the manuscript challenged expert translators. The melting glaciers, affected by climate change, concerned environmental scientists. Having studied the evidence carefully, the jury reached a unanimous verdict. The celebrated author, honored with numerous awards, remained remarkably humble. Frightened by thunder, the puppy hid beneath the bed. The proposed legislation, supported by various groups, awaited final approval.
    """,
    
    "gerunds_gerund_phrases": """
    Swimming competitively requires tremendous dedication and physical stamina. Training six days a week exhausts even the most committed athletes. Perfecting each stroke takes years of patient practice. Watching Olympic swimmers inspires young athletes to pursue their dreams. Breaking personal records motivates them through difficult workouts. Maintaining proper nutrition supports their demanding training schedule. Competing against talented opponents sharpens their skills considerably. Visualizing success helps athletes overcome pre-race anxiety. Listening to their coach's advice improves their technique steadily. Stretching before practice prevents painful injuries. Building endurance requires gradually increasing workout intensity. Supporting teammates creates a positive training environment. Analyzing race videos reveals areas needing improvement. Setting realistic goals keeps athletes focused and motivated. Balancing academics with training challenges student athletes daily. Traveling to competitions exposes them to different pool conditions. Winning medals rewards years of sacrifice and hard work. Learning from defeats builds character and resilience. Celebrating achievements with family makes victories more meaningful. Continuing their swimming careers through college opens new opportunities.
    """,
    
    "infinitives_infinitive_phrases": """
    To succeed in science requires curiosity and persistence. The students decided to conduct additional experiments. To understand complex theories, they studied fundamental principles first. The professor encouraged everyone to ask challenging questions. To make groundbreaking discoveries often takes years of research. They planned to present their findings at the conference. To verify their hypothesis, researchers repeated the experiment multiple times. The team hoped to receive funding for continued studies. To solve this equation requires advanced mathematical knowledge. Students learned to approach problems systematically. To become a skilled researcher takes dedication and patience. The laboratory offered opportunities to work with sophisticated equipment. To publish in prestigious journals remains their ultimate goal. They agreed to collaborate with international colleagues. To advance human knowledge motivates scientists worldwide. The institute promised to support innovative research projects. To challenge existing theories requires substantial evidence. They struggled to explain the unexpected results. To inspire future scientists becomes every educator's mission. The department arranged to host visiting scholars regularly.
    """,
    
    "subject_verb_agreement": """
    The orchestra prepares diligently for tonight's performance at the concert hall. Each musician practices their individual parts with dedication. The violins create a haunting melody that echoes through the auditorium. The conductor reviews every note of the complex symphony. There are fifty talented performers on stage this evening. Neither the pianist nor the cellists have missed a single rehearsal. Everyone contributes to the harmonious sound. The brass section plays with exceptional power and precision. Several soloists feature prominently in the second movement. The audience always appreciates their hard work and talent. Nobody leaves before the final crescendo. The percussion instruments add dramatic emphasis at key moments. Both the woodwinds and strings blend beautifully together. Someone adjusts the stage lighting for optimal effect. The entire ensemble works as one unified body. Many hours of practice result in flawless execution. The musicians' passion shines through their performance. Everything comes together perfectly on opening night. The standing ovation proves their success. Music brings people together in wonderful ways.
    """,
    
    "collective_nouns_special_subjects": """
    The committee has reached its decision after lengthy deliberation. The jury deliberates carefully before announcing their verdict. The team is celebrating its championship victory enthusiastically. The family are arguing among themselves about vacation plans. Politics is a challenging field requiring diplomatic skills. Mathematics builds upon fundamental concepts systematically. The news about the discovery was spreading rapidly worldwide. Twenty dollars is enough for lunch at that restaurant. Five miles seems like a short distance to experienced runners. The United States has diverse geographical features and climates. Measles is preventable through proper vaccination programs. The band plays its signature song at every concert. The group were discussing their individual responsibilities. Economics influences governmental policy decisions significantly. Two weeks is insufficient time for completing this project. The series of lectures covers advanced theoretical concepts. The audience shows its appreciation through thunderous applause. Three-quarters of the students have submitted their assignments. The staff are meeting in their respective departments. Physics explains natural phenomena through mathematical models.
    """,
    
    "indefinite_pronouns_subjects": """
    Everyone has submitted their final research papers on time. Somebody left mysterious footprints in the fresh snow. Neither of the proposals meets all the specified requirements. Several were considered before making the final selection. Each of the students receives individual attention from tutors. Many have attempted this challenging puzzle without success. Both are equally qualified for the prestigious position. Anyone is welcome to attend the public lecture series. Few understand the complexity of quantum mechanics fully. Nothing is impossible with determination and hard work. All of the evidence supports the new theory conclusively. Most have agreed to the proposed schedule changes. None of the experiments produced the expected results. One never knows what discoveries await in science. Some are naturally gifted in mathematical reasoning. Either is acceptable according to the guidelines. Much has been written about this historical event. Another has volunteered to lead the project. Everything is proceeding according to the planned timeline. No one has solved this ancient mathematical problem.
    """,
    
    "compound_subjects_agreement": """
    Neither the students nor the teacher was prepared for the surprise inspection. Both the theory and the application require careful consideration. Either the morning session or the afternoon workshops provide certification credits. The director and the producer have different visions for the film. Neither rain nor snow prevents the mail delivery service. Bread and butter is a simple but satisfying breakfast. The horse and carriage was a popular tourist attraction. Either my brother or my sisters are planning the reunion. Not only the players but also the coach was disappointed. Rice and beans provides complete protein nutrition. The secretary and treasurer is the same person this year. Neither the document nor the photographs were admitted as evidence. Both determination and talent are necessary for success. The thunder and lightning frighten the young children. Either the president or her advisors make the final decision. Rock and roll has influenced multiple generations significantly. The judge and jury have reached different conclusions. Neither the original nor the copies are available currently. Time and tide wait for no one. Peanut butter and jelly is America's favorite sandwich combination.
    """
}

class PassageDuplicateDetector:
    """Robust duplicate detection with multiple strategies"""
    
    def __init__(self):
        self.existing_passages: List[str] = []
        self.existing_hashes: Set[str] = set()
        self.existing_fingerprints: Set[str] = set()
        
    def load_existing_passages(self):
        """Load all existing passages for comparison"""
        try:
            print("🔍 Loading existing passages for duplicate detection...")
            
            # Get all existing passages
            result = supabase.table('question_cache')\
                .select('question')\
                .not_.is_('question', 'null')\
                .execute()
            
            passages = []
            for record in result.data:
                if record['question'] and 'context' in record['question']:
                    context = record['question']['context']
                    if context and len(context.strip()) > MIN_PASSAGE_LENGTH:
                        passages.append(context.strip())
            
            self.existing_passages = passages
            self.existing_hashes = {self._create_content_hash(p) for p in passages}
            self.existing_fingerprints = {self._create_content_fingerprint(p) for p in passages}
            
            print(f"✅ Loaded {len(self.existing_passages)} existing passages for comparison")
            
        except Exception as e:
            print(f"⚠️  Failed to load existing passages: {e}")
            self.existing_passages = []
            self.existing_hashes = set()
            self.existing_fingerprints = set()
    
    def _create_content_hash(self, text: str) -> str:
        """Create SHA-256 hash for exact duplicate detection"""
        normalized = re.sub(r'\s+', ' ', text.lower().strip())
        return hashlib.sha256(normalized.encode()).hexdigest()
    
    def _create_content_fingerprint(self, text: str) -> str:
        """Create content fingerprint for near-duplicate detection"""
        # Remove punctuation, normalize whitespace, convert to lowercase
        normalized = re.sub(r'[^\w\s]', '', text.lower())
        normalized = re.sub(r'\s+', ' ', normalized.strip())
        
        # Extract key words (longer than 3 characters)
        words = [w for w in normalized.split() if len(w) > 3]
        
        # Sort words and create fingerprint
        fingerprint = '|'.join(sorted(set(words)))
        return hashlib.md5(fingerprint.encode()).hexdigest()
    
    def _calculate_fuzzy_similarity(self, text1: str, text2: str) -> float:
        """Calculate fuzzy similarity between two texts"""
        # Normalize both texts
        norm1 = re.sub(r'[^\w\s]', '', text1.lower())
        norm2 = re.sub(r'[^\w\s]', '', text2.lower())
        
        # Use SequenceMatcher for similarity
        return SequenceMatcher(None, norm1, norm2).ratio()
    
    def is_duplicate(self, new_passage: str) -> Tuple[bool, str]:
        """
        Comprehensive duplicate detection with multiple strategies
        Returns (is_duplicate, reason)
        """
        if not new_passage or len(new_passage.strip()) < MIN_PASSAGE_LENGTH:
            return True, "Passage too short"
        
        new_passage = new_passage.strip()
        
        # Strategy 1: Exact hash match
        new_hash = self._create_content_hash(new_passage)
        if new_hash in self.existing_hashes:
            return True, "Exact duplicate (hash match)"
        
        # Strategy 2: Content fingerprint match
        new_fingerprint = self._create_content_fingerprint(new_passage)
        if new_fingerprint in self.existing_fingerprints:
            return True, "Near duplicate (fingerprint match)"
        
        # Strategy 3: Fuzzy similarity check
        for existing_passage in self.existing_passages:
            similarity = self._calculate_fuzzy_similarity(new_passage, existing_passage)
            if similarity >= FUZZY_SIMILARITY_THRESHOLD:
                return True, f"High similarity ({similarity:.2%}) to existing passage"
        
        return False, "Unique passage"
    
    def add_passage(self, passage: str):
        """Add new passage to tracking"""
        if passage and len(passage.strip()) > MIN_PASSAGE_LENGTH:
            passage = passage.strip()
            self.existing_passages.append(passage)
            self.existing_hashes.add(self._create_content_hash(passage))
            self.existing_fingerprints.add(self._create_content_fingerprint(passage))

class GrammarTextbookParser:
    """Parse predefined grammar passages"""
    
    def __init__(self):
        self.chapters = {}
        
    def fetch_textbook(self) -> bool:
        """Load predefined grammar passages instead of fetching from URL"""
        try:
            print("📥 Loading predefined grammar passages...")
            # No need to fetch, we're using GRAMMAR_PASSAGES
            print(f"✅ Grammar passages loaded successfully ({len(GRAMMAR_PASSAGES)} concepts)")
            return True
            
        except Exception as e:
            print(f"❌ Failed to load grammar passages: {e}")
            return False
    
    def parse_chapters(self) -> Dict[str, Dict]:
        """Convert predefined passages to chapter format"""
        try:
            print("📖 Processing grammar concept passages...")
            
            chapters = {}
            
            # Convert GRAMMAR_CONCEPTS_MAPPING and GRAMMAR_PASSAGES to chapters
            for chapter_key, grammar_concept in GRAMMAR_CONCEPTS_MAPPING.items():
                if grammar_concept in GRAMMAR_PASSAGES:
                    # Get the title from the concept name
                    title = grammar_concept.replace('_', ' ').title()
                    
                    chapters[chapter_key] = {
                        'title': title,
                        'content': GRAMMAR_PASSAGES[grammar_concept].strip(),
                        'grammar_concept': grammar_concept
                    }
            
            self.chapters = chapters
            print(f"✅ Processed {len(chapters)} grammar concepts")
            
            return chapters
            
        except Exception as e:
            print(f"❌ Failed to process chapters: {e}")
            return {}
    
    def extract_passage(self, chapter_key: str, target_length: Tuple[int, int] = (300, 400)) -> Optional[str]:
        """Extract passage - since our passages are already sized, just return them"""
        if chapter_key not in self.chapters:
            return None
        
        content = self.chapters[chapter_key]['content']
        
        # Our predefined passages are already properly sized, so just return them
        word_count = len(content.split())
        
        # If the passage is within acceptable range (allowing some flexibility)
        if target_length[0] * 0.8 <= word_count <= target_length[1] * 1.2:
            return content
        
        # If too long, truncate to target length
        if word_count > target_length[1]:
            words = content.split()
            truncated = ' '.join(words[:target_length[1]])
            # Find the last complete sentence
            last_period = truncated.rfind('.')
            if last_period > 0:
                return truncated[:last_period + 1]
            return truncated
        
        # If too short, return as is (better than nothing)
        return content

class ISEEQuestionGenerator:
    def __init__(self):
        self.conversation_history = []
        self.used_chapters = set()
        self.duplicate_detector = PassageDuplicateDetector()
        self.textbook_parser = GrammarTextbookParser()
        self.generation_stats = {
            'total_attempts': 0,
            'duplicates_rejected': 0,
            'successful_generations': 0,
            'chapters_skipped': 0
        }
        
    def initialize_system(self):
        """Initialize the complete system"""
        print("🚀 Initializing Grammar Textbook Question Generator...")
        
        # Load duplicate detection
        self.duplicate_detector.load_existing_passages()
        
        # Fetch and parse textbook
        if not self.textbook_parser.fetch_textbook():
            return False
        
        if not self.textbook_parser.parse_chapters():
            return False
            
        return True
        
    def generate_content_hash(self, content: str) -> str:
        """Generate SHA-256 hash for duplicate detection"""
        return hashlib.sha256(content.encode()).hexdigest()
    
    def get_difficulty_for_grammar_concept(self, grammar_concept: str) -> int:
        """Assign difficulty level based on grammar concept complexity"""
        if grammar_concept in SIMPLE_GRAMMAR:
            return 3
        elif grammar_concept in MEDIUM_GRAMMAR:
            return 5
        else:
            return 7
    
    def get_grade_for_grammar_concept(self, grammar_concept: str) -> int:
        """Assign grade level based on grammar concept complexity"""
        if grammar_concept in SIMPLE_GRAMMAR:
            return random.choice([5, 6])
        elif grammar_concept in MEDIUM_GRAMMAR:
            return random.choice([6, 7, 8])
        else:
            return random.choice([8, 9])
    
    def generate_grammar_questions(self, passage: str, chapter_info: Dict, attempt_num: int = 1) -> Optional[Dict]:
        """Generate questions with enhanced answer choice strategy"""
        
        self.generation_stats['total_attempts'] += 1
        
        grammar_concept = chapter_info['grammar_concept']
        chapter_title = chapter_info['title']
        
        prompt = f"""You are an expert ISEE test prep content creator specializing in grammar education.

PASSAGE TO ANALYZE:
{passage}

GRAMMAR FOCUS: {grammar_concept}
CHAPTER CONTEXT: {chapter_title}

CRITICAL ANSWER CHOICE REQUIREMENTS:
- Generate exactly 5 answer choices (A, B, C, D, E) for each question
- TWO choices must be very similar - one correct, one close distractor
- Provide comprehensive explanations for why EACH wrong answer is incorrect
- Make all distractors plausible but clearly wrong upon analysis

QUESTION REQUIREMENTS:
Generate exactly 5 questions in this specific order:

1. MAIN IDEA: What is the primary purpose or central theme of this passage?
2. SUPPORTING DETAILS: A specific factual question about details mentioned in the passage
3. INFERENCE: What can be reasonably concluded or implied from the passage?
4. VOCABULARY IN CONTEXT: Meaning of a specific word as used in the passage
5. GRAMMAR FOCUS: Explicitly test the grammar concept "{grammar_concept}"

ANSWER CHOICE STRATEGY EXAMPLE:
If testing subject-verb agreement:
- Correct: "The subject and verb must agree in number"
- Close distractor: "The subject and verb must agree in person" (very similar but wrong)
- Other distractors: plausible but clearly different concepts

REQUIRED JSON STRUCTURE:
{{
    "passage": "{passage[:50]}...",
    "questions": [
        {{
            "question_type": "main_idea",
            "question": "What is the main purpose of this passage?",
            "options": {{
                "A": "First option",
                "B": "Second option (could be correct answer)",
                "C": "Third option (could be close distractor)", 
                "D": "Fourth option",
                "E": "Fifth option"
            }},
            "correct": "B",
            "explanation": "B is correct because [detailed reason]. A is incorrect because [specific reason]. C is incorrect because [specific reason for close distractor]. D is incorrect because [specific reason]. E is incorrect because [specific reason]."
        }},
        // ... 4 more questions following same pattern
    ],
    "grammar_concept": "{grammar_concept}",
    "chapter_theme": "{chapter_title}"
}}

CRITICAL REQUIREMENTS:
- Ensure TWO options are very similar for each question
- Explain why ALL four wrong answers are incorrect
- Base all questions directly on the passage content
- Make the grammar question explicitly test {grammar_concept}
- Use vocabulary appropriate for grades 5-9"""

        try:
            # Generate content
            response = model.generate_content(prompt)
            
            # Parse response
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
                
            content = json.loads(response_text)
            
            # Validate structure
            required_fields = ['passage', 'questions', 'grammar_concept', 'chapter_theme']
            if not all(field in content for field in required_fields):
                raise ValueError(f"Missing required fields: {required_fields}")
                
            if len(content['questions']) != 5:
                raise ValueError(f"Expected 5 questions, got {len(content['questions'])}")
            
            # Validate answer choices
            for i, q in enumerate(content['questions']):
                if len(q['options']) != 5:
                    raise ValueError(f"Question {i+1} must have exactly 5 options")
                
                required_options = {'A', 'B', 'C', 'D', 'E'}
                if set(q['options'].keys()) != required_options:
                    raise ValueError(f"Question {i+1} must have options A-E")
            
            # Check for duplicates
            is_duplicate, reason = self.duplicate_detector.is_duplicate(passage)
            
            if is_duplicate:
                self.generation_stats['duplicates_rejected'] += 1
                print(f"⚠️  Duplicate detected (Attempt #{attempt_num}): {reason}")
                return None
            
            print(f"✅ Generated questions for: {chapter_title}")
            return content
            
        except Exception as e:
            print(f"❌ Question generation failed (Attempt #{attempt_num}): {e}")
            return None
    
    def save_questions_to_supabase(self, passage_content: Dict, grade: int, difficulty: int) -> bool:
        """Save generated questions to Supabase"""
        
        try:
            passage_text = passage_content['passage']
            questions = passage_content['questions']
            grammar_concept = passage_content['grammar_concept']
            
            saved_count = 0
            
            # Save each question separately
            for i, q in enumerate(questions):
                # Generate unique hash
                content_for_hash = f"{passage_text}|{q['question']}|{q['correct']}"
                question_hash = self.generate_content_hash(content_for_hash)
                
                # Check if hash already exists
                existing = supabase.table('question_cache')\
                    .select('id')\
                    .eq('question_hash', question_hash)\
                    .execute()
                
                if existing.data:
                    print(f"⚠️  Question {i+1}/5 already exists in database, skipping...")
                    continue
                
                # Build standardized question structure
                question_data = {
                    "context": passage_text,
                    "question": q['question'],
                    "options": q['options'],
                    "correct": q['correct'],
                    "explanation": q['explanation'],
                    "grammar_concept": grammar_concept,
                    "question_type": q.get('question_type', f'question_{i+1}')
                }
                
                # Insert to Supabase
                insert_data = {
                    "topic": "english_comprehension",
                    "difficulty": difficulty,
                    "grade": grade,
                    "question": question_data,
                    "ai_model": "gemini-2.5-flash",
                    "question_hash": question_hash
                }
                
                result = supabase.table('question_cache').insert(insert_data).execute()
                saved_count += 1
                print(f"✅ Saved question {i+1}/5 for {grammar_concept} (Grade {grade})")
            
            if saved_count > 0:
                # Add passage to duplicate detector
                self.duplicate_detector.add_passage(passage_text)
                self.generation_stats['successful_generations'] += 1
                return True
            else:
                print(f"⚠️  All questions already existed")
                return False
                
        except Exception as e:
            print(f"❌ Failed to save questions: {e}")
            return False
    
    def process_textbook_chapters(self, max_chapters_per_run: int = 20):
        """Process textbook chapters and generate questions"""
        
        if not self.initialize_system():
            print("❌ Failed to initialize system")
            return
        
        chapters = self.textbook_parser.chapters
        available_chapters = [k for k in chapters.keys() if k not in self.used_chapters]
        
        if not available_chapters:
            print("⚠️  No new chapters available to process")
            return
        
        # Randomly select chapters to process
        chapters_to_process = random.sample(
            available_chapters, 
            min(max_chapters_per_run, len(available_chapters))
        )
        
        print(f"📚 Processing {len(chapters_to_process)} chapters from grammar textbook")
        
        total_generated = 0
        
        for chapter_key in chapters_to_process:
            chapter_info = chapters[chapter_key]
            print(f"\n📖 Processing Chapter {chapter_key}: {chapter_info['title']}")
            
            # Extract passage
            passage = self.textbook_parser.extract_passage(chapter_key)
            
            if not passage:
                print(f"  ⚠️  Could not extract suitable passage from chapter {chapter_key}")
                self.generation_stats['chapters_skipped'] += 1
                continue
            
            word_count = len(passage.split())
            print(f"  📝 Extracted passage ({word_count} words)")
            
            # Determine grade and difficulty
            grammar_concept = chapter_info['grammar_concept']
            difficulty = self.get_difficulty_for_grammar_concept(grammar_concept)
            grade = self.get_grade_for_grammar_concept(grammar_concept)
            
            # Generate questions with retry logic
            success = False
            for attempt in range(1, MAX_RETRIES_PER_TOPIC + 1):
                content = self.generate_grammar_questions(passage, chapter_info, attempt)
                
                if content:
                    # Save to database
                    if self.save_questions_to_supabase(content, grade, difficulty):
                        total_generated += 5  # 5 questions per passage
                        success = True
                        self.used_chapters.add(chapter_key)
                        print(f"  ✅ Generated 5 questions successfully (Attempt {attempt})")
                        break
                
                # Add delay between retries
                if attempt < MAX_RETRIES_PER_TOPIC:
                    time.sleep(1)
            
            if not success:
                print(f"  ❌ Failed to generate questions after {MAX_RETRIES_PER_TOPIC} attempts")
                self.generation_stats['chapters_skipped'] += 1
        
        # Print final statistics
        self._print_generation_stats(total_generated)
    
    def _print_generation_stats(self, total_generated: int):
        """Print comprehensive generation statistics"""
        stats = self.generation_stats
        
        print(f"\n🎉 Grammar textbook processing complete!")
        print(f"📊 GENERATION STATISTICS:")
        print(f"   Total questions generated: {total_generated}")
        print(f"   Total generation attempts: {stats['total_attempts']}")
        print(f"   Successful generations: {stats['successful_generations']}")
        print(f"   Duplicates rejected: {stats['duplicates_rejected']}")
        print(f"   Chapters skipped: {stats['chapters_skipped']}")
        
        if stats['total_attempts'] > 0:
            success_rate = (stats['successful_generations'] / stats['total_attempts']) * 100
            duplicate_rate = (stats['duplicates_rejected'] / stats['total_attempts']) * 100
            print(f"   Success rate: {success_rate:.1f}%")
            print(f"   Duplicate detection rate: {duplicate_rate:.1f}%")

def main():
    """Main execution function"""
    generator = ISEEQuestionGenerator()
    
    print("🔧 Grammar Content Question Generator Starting...")
    print(f"📚 Using predefined grammar passages for all concepts")
    print(f"🛡️  Duplicate detection enabled")
    print(f"📝 Enhanced answer choice strategy: 2 similar options per question")
    print(f"📊 Grades: 5-9 only")
    
    # Process textbook chapters
    generator.process_textbook_chapters(max_chapters_per_run=15)
    
    print("\n✅ All operations completed successfully!")

if __name__ == "__main__":
    main()