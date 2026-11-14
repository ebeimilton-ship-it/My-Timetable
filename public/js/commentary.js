/* ──────────────────────────────────────────────────────────────
   commentary.js — student commentary engine
   Schedule-aware comments, jokes, health tips, quotes, motivation,
   Maseno tips and facts. Add lines by pasting more strings into the
   arrays below (one per line, quoted, trailing comma).
   Uses fmtHour() from app.js at call time.
   ────────────────────────────────────────────────────────────── */

const CLASS_BANNER_COMMENTS = {
backToBack: [
  "Zero gaps on {day} — pack snacks and a will to live.",
  "Back-to-back sessions on {day}? Bold strategy. Bring a power bank.",
  "{day} is not a day, it's an endurance sport."
],
earlyBird: [
  "That {time} start says you and sleep are no longer on speaking terms.",
  "An early one at {time} — rise, shine, and immediately regret it.",
  "{time}? Bold of you to assume you'll be conscious."
],
lateNight: [
  "A slot past {time}? Living the campus vampire lifestyle.",
  "{time} sessions — for when the day just isn't long enough to suffer."
],
heavyDay: [
  "{day} is doing the work of the whole week by itself. Respect.",
  "{count} sessions crammed into {day}? That's not a schedule, that's a hostage situation.",
  "{day} really said 'no breaks for you.'"
],
freeDay: [
  "{day} is suspiciously empty... we see you planning that nap.",
  "{day} off? Living your best life while the rest of us suffer.",
  "A whole free {day} — don't waste it all on TikTok. Okay, waste some of it."
],
lightLoad: [
  "Only {count} entries? Someone's taking it easy this week 👀",
  "Light schedule — plenty of room for procrastination, I mean 'flexibility.'",
  "{count} slots. Ambitious minimalism or last-minute planning? No judgment."
],
heavyLoad: [
  "{count} entries?! Who hurt you.",
  "That's {count} slots — your calendar and your social life are officially strangers.",
  "{count} sessions packed in. Coffee isn't a drink anymore, it's a lifestyle."
],
generic: [
  "Schedule locked in. May the odds (and your alarm clock) be ever in your favor.",
  "There it is — your week, fully booked and slightly terrifying.",
  "Timetable built. Time to pretend you'll actually follow it.",
  "Behold: a schedule so organized, even you're surprised.",
  "Your week, mapped out. Chaos, but make it structured."
]
};

// Schedule-aware jokes: picked based on detected conditions (early class, huge gap, Friday late), else generic.
const CLASS_BANNER_JOKES_BY_CONDITION = {
earlyBird: [
  "A 7:00 AM class? Bold of the department to assume human brain cells function before the sun is fully up.",
  "7:00 AM lectures should legally come with a complimentary black coffee and a pillow.",
  "Attending a 7:00 AM class counts as extreme cardio for the soul.",
  "Setting an alarm for 6:00 AM just to stare at the wall for 45 minutes regretting your life choices.",
  "7:00 AM: The time of day where you aren't really awake, you're just piloting a meat suit to a lecture hall.",
  "A 7:00 AM lecture means waking up at 5:50 AM, questioning your major at 6:15 AM, and sleepwalking out the door by 6:40 AM.",
  "7:00 AM classes don't build character; they just build a profound dependence on strong tea and pure willpower.",
  "If you see me in a 7:00 AM class nodding my head, I am not agreeing with the lecturer. I am fighting a losing battle against gravity.",
  "Waking up for a 7:00 AM class is the closest thing to survival horror a student can experience in real life.",
  "Shout out to everyone sitting in the back row of a 7:00 AM lecture with their eyes open but their brain entirely offline.",
  "Attending a 7:00 AM class is basically paying tuition to watch your lecturer struggle with the projector while you struggle to keep your eyelids open.",
  "Your alarm at 6:00 AM doesn't sound like a wake-up call; it sounds like a personal attack on your peace of mind.",
  "At 7:00 AM, the brain operates in 'safe mode'—no styling, no scripts, just basic survival HTML processing.",
  "Only two types of people are awake on campus at 6:30 AM: those who are incredibly disciplined, and those who haven't slept yet.",
  "That cold morning breeze hitting your face on your way to a 7:00 AM lecture is the universe's version of a splash of ice water."
],
hugeGap: [
  "A 4-hour gap between classes? Perfect time to plan a nap you'll regret, or start an assignment you'll actually finish 10 minutes before the deadline.",
  "That massive gap in your schedule isn't free time; it's a mental endurance test.",
  "Four hours of free time on campus. Time to wander around, look busy, and spend money you don't have on snacks.",
  "The awkwardness of a huge gap: too short to go home and sleep comfortably, too long to sit productively in the library.",
  "A 3+ hour gap is just the universe daring you to order a heavy meal and fight the heavy food-coma sleep during your next class.",
  "A 5-hour gap? At this point, you don't have a schedule gap; you have a part-time job configuration where you don't get paid.",
  "That massive gap is dangerous. Go home and you'll miss the afternoon class. Stay on campus and you'll spend your last coins on food.",
  "A 4-hour gap is long enough to contemplate every life decision that led you to this specific hallway.",
  "Spending a 3-hour gap wandering around campus trying to look like you have an important meeting to attend.",
  "The true test of discipline is not sleeping on a library desk during a massive afternoon timetable gap.",
  "A 6-hour gap in your timetable isn't a break. It's a test of your financial discipline to see if you can resist buying three lunches.",
  "Finding a cozy corner during a 4-hour gap is like finding prime real estate. Guard it with your life.",
  "During a massive gap, you promise yourself you'll study. Fast forward 3 hours, and you've read one paragraph and watched 14 random videos.",
  "A huge gap on a rainy day is a special kind of trap where you stare at the rain and contemplate the meaning of life.",
  "That awkward moment when your gap is so long that your laptop battery dies, your phone battery is at 12%, and you forgot your charger."
],
fridayLate: [
  "A Friday evening lecture? Whoever designed this timetable definitely doesn't want you to enjoy your weekend.",
  "Friday afternoon classes are just a cruel testing ground for your attention span.",
  "Your Friday late class is standing between you and freedom. Stay strong.",
  "Attending a Friday late class should give you automatic extra marks for sheer psychological endurance.",
  "The lecturer wants to leave, you want to leave, the walls want to leave. Yet here everyone sits.",
  "A Friday late afternoon class? Even the whiteboard markers have lost their will to live at this point in the week.",
  "Attending a Friday evening lecture means watching the clock count down like a rocket launch sequence.",
  "Friday late sessions are entirely conversational—nobody is taking notes, we are all just holding hands trying to survive.",
  "Whoever put a core unit on Friday at 4:00 PM deserves a strongly worded email from the entire student body.",
  "The campus is completely emptying out, but your class is sitting there like a dedicated survival squad.",
  "A Friday late lecture is like a movie with no plot—everyone is just waiting for the credits to roll so they can run.",
  "By Friday at 4:00 PM, the lecturer's slides look like hieroglyphics and the classroom fan sounds like a lullaby.",
  "Attending class on Friday late afternoon is proof that your discipline muscle is fully developed. Take a bow.",
  "The absolute silence in a Friday late class isn't focus; it's the collective exhaustion of 100 students waiting for the weekend.",
  "Your friends are already sending texts about weekend plans while you are still negotiating terms with a complex algorithm in class."
],
generic: [
  "Your schedule looks busy, but we both know 40% of that lecture time will be spent scrolling through your phone.",
  "Remember: walking to a lecture that gets canceled last minute is the ultimate campus heartbreak.",
  "A packed schedule just means you are efficiently optimizing your procrastination windows.",
  "May your lectures be short, your Wi-Fi be strong, and your lecturer's microphone actually work today.",
  "A wise student once said: 'I'll just read the slides at home.' They never read the slides.",
  "Your timetable looks solid, but let's be honest: your attendance rate depends entirely on whether it rains or not.",
  "May your lecture hall have functional sockets and may nobody sit next to you with a laptop running a loud cooling fan.",
  "Pro tip: Napping for 'just 15 minutes' with your clothes on after a long day is an automatic trap that leads straight to 3:00 AM.",
  "A packed timetable just means you have fewer hours in the day to stress about the things you are actively avoiding.",
  "Legend says if you stare at a broken portal loading screen long enough, you can actually hear your patience evaporating.",
  "Group assignments are 10% actual work and 90% chasing people who suddenly became secret agents and went completely off-grid.",
  "A lecture slide with 500 words of dense text is not a slide; it's a personal challenge to see how fast you can fall asleep.",
  "The speed at which a student can pack their bag when the lecturer says 'In conclusion...' violates several laws of physics.",
  "May your code compile on the first try and may your group members actually reply to your messages before the absolute final hour.",
  "Every student has a folder on their desktop labeled 'New Folder (4)' containing PDFs they swear they will read before the main exams."
]
};

const CLASS_BANNER_JOKES = [
  "Why did the student bring a ladder to class? To reach the higher grades.",
  "I told my timetable a joke. It didn't laugh — too many periods.",
  "Attendance is optional, they said. My GPA disagreed."
];

const CLASS_BANNER_HEALTH_TIPS = [
  "Drink some water between classes — your brain is 75% water and 25% deadlines.",
  "Stand up and stretch during the break. Your back will thank you later.",
  "Try to get 7+ hours of sleep tonight — cramming works better on a rested brain.",
  "Sitting at your desk for hours straight ruins your posture. Stand up right now, shake it out, and do 20 air squats to get the blood pumping. No excuses.",
  "Hydration check: A dehydrated brain operates at half capacity. Drink a glass of water before your next lecture.",
  "Staring at your screen for too long? Use the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds.",
  "If your day is packed back-to-back, drop and do 15 pushups right now. Reset your energy level through movement.",
  "Fix your posture right now. Drop your shoulders, unclench your jaw, and straighten your spine.",
  "Never replace a night of real sleep with energy drinks. Your brain flushes out toxins during deep sleep—don't cheat the process.",
  "Eye strain is real. Lower your mobile phone brightness if you're editing code or reading PDFs in a dimly lit room.",
  "Take 5 deep abdominal breaths right now. Deep oxygenation resets the nervous system and lowers cortisol (stress).",
  "Don't survive solely on processed carbohydrates and mandazis. Your brain needs healthy fats and proteins to sustain long periods of heavy focus.",
  "Walk without looking at your phone. Give your brain a 10-minute break from processing notifications while moving between halls.",
  "Don't study through your hunger signals. A starving brain hoards glucose, destroying your working memory and logic processing.",
  "If your neck feels stiff from staring down at your phone editor, tuck your chin directly back into your neck 10 times to reset your cervical spine alignment.",
  "Hydration rule: If you're waiting until you feel incredibly thirsty to drink water, your body is already mildly dehydrated.",
  "Avoid eating heavy, greasy meals right before a long lecture block unless you want to spend two hours fighting an intense food coma.",
  "Every 60 minutes, roll your ankles and wrists in circles to keep blood flowing smoothly while sitting in tight lecture halls.",
  "Your feet carry you across campus all day. Take a few minutes at night to stretch your calves and arches to prevent fatigue.",
  "Never sacrifice consecutive nights of sleep for revision. Sleep is when your brain converts short-term study notes into permanent long-term memory structures.",
  "Give your eyes a screen break. Close them completely for 60 seconds after finishing a heavy reading or coding block.",
  "Don't live on caffeine alone. Pair your tea or coffee with a real snack to avoid an aggressive energy crash in the middle of an afternoon lecture.",
  "Take three deep, slow breaths right before stepping into an exam room or presentation. It tricks your nervous system into dropping stress levels.",
  "If you feel physically sluggish on campus, step outside into direct sunlight for 5 minutes. The natural light resets your circadian rhythm and alertness.",
  "Wash your hands thoroughly after using shared computer labs or handling desk surfaces—campus spaces are high-traffic zones.",
  "Keep your heavy backpack adjusted properly. Wear both straps, not just one, to keep your shoulders level and avoid long-term lower back pain.",
  "When working on a long mobile coding sprint, look up at the horizon every few minutes to keep your eye muscles from locking up.",
  "Stretch your hamstrings and lower back right now. Flexing forward to touch your toes releases tension built up from hard campus chairs.",
  "Limit your sugar intake during high-stress study weeks. Sugar spikes lead to rapid crashes that leave you more exhausted than before.",
  "If you find yourself getting stuck on a hard engineering or coding problem, walk away. A brief 10-minute walk fixes cognitive blocks.",
  "Keep your ears safe. If you use earphones while trekking across campus, keep the volume below 60% so you remain aware of your surroundings.",
  "Don't skip breakfast on a long lecture day. Your body needs initial fuel to kickstart cognitive metabolic functions for the morning grind.",
  "Rest your mind. Spend at least 15 minutes a day in absolute silence without checking notifications, listening to audio, or processing data.",
  "Avoid studying in your bed if you can. It tricks your brain into associating your sleep sanctuary with high-stress academic focus, leading to insomnia.",
  "Unclench your teeth right now. Stress makes us bite down unconsciously, which causes tension headaches and jaw fatigue by evening.",
  "If your eyes feel gritty or dry from reading research papers, blink rapidly 20 times to naturally lubricate your eyes.",
  "Keep your feet flat on the floor when sitting at a desk. Crossing your legs for long periods restricts blood flow and strains your pelvis.",
  "When reading complex code or dense textbooks, stand up and pace around your room. Physical movement helps consolidate logical concepts.",
  "A quick 5-minute stretch of your chest and shoulders reverses the 'hunch' caused by typing on a laptop or writing on a desk all day.",
  "Drink water before you drink caffeine. Coffee on an empty, dehydrated stomach can spike anxiety and cause an early morning jitters-crash.",
  "Keep your mobile screen at least 12 inches away from your face to reduce the focusing strain on your optic nerves.",
  "Deep breathing check: Inhale slowly through your nose for 4 seconds, hold for 4, and exhale for 4. Reset your mental processing speed.",
  "If you study with headphones, use the ambient noise feature or keep one ear free so your brain doesn't feel isolated and fatigued by heavy audio pressure.",
  "Get up and do 10 slow, deep bodyweight squats. It flushes fresh oxygen to your lower limbs and prevents deep vein lethargy.",
  "Keep a healthy snack like nuts or fruit in your bag. Eating small bites of real food maintains stable glucose levels for your brain.",
  "Wipe down your phone screen daily. We touch our phones constantly on campus, making them prime hotspots for unwanted bacteria.",
  "If you feel a headache starting, try drinking a full glass of water first. Mild dehydration is the single most common cause of daytime headaches.",
  "Don't slouch in lecture hall seats. Slide your hips all the way to the back of the chair to let the backrest support your spine naturally.",
  "Take your eyes off all screens for at least 30 minutes before you sleep. Let your brain produce natural melatonin for deep, restorative rest.",
  "Gently roll your shoulders backward 10 times right now. Release the weight of today's academic load from your upper trapezius muscles.",
  "Try to balance your heavy study days with fresh air. Even a brief walk in a green space significantly reduces cognitive fatigue.",
  "Limit high-energy energy drinks to emergency scenarios only. Relying on them daily wears down your adrenal system and ruins your sleep cycles.",
  "Your mental health is just as physical as your body. If your brain feels completely fried, stop. Rest is an active part of preparation."
];

const CLASS_BANNER_QUOTES = [
  "\"The expert in anything was once a beginner.\" — Helen Hayes",
  "\"Success is the sum of small efforts, repeated day in and day out.\" — Robert Collier",
  "\"Don't watch the clock; do what it does. Keep going.\" — Sam Levenson"
];

const CLASS_BANNER_MOTIVATION = [
  "The pain of discipline is temporary. The pain of regret lasts forever. Show up and do the work.",
  "Your schedule looks tough because you are capable of handling a heavy load. Stop looking for the easy way out.",
  "When you don't want to go to that lecture, that's exactly when you need to go. Master your mind, don't let your feelings run your day.",
  "Uncommon results require uncommon discipline. While others are sleeping or skipping, you build.",
  "Nobody is coming to save you. Nobody is going to write the code or study the notes for you. It's entirely on you.",
  "The conditions are rarely perfect. Do it tired. Do it under-resourced. Do it anyway.",
  "Do not wish it were easier; wish you were better. Build the capacity to carry heavy things.",
  "An amateur waits for motivation or inspiration. A professional rolls up their sleeves, builds a routine, and relies on strict habit.",
  "Your future self is either going to thank you or curse you for what you choose to do with your free time today.",
  "Excuses look best to the person making them. Drop the narrative, look at the reality, and execute.",
  "If you quit now, you'll end up right back where you started—wishing desperately to be exactly where you are standing right now.",
  "Small daily disciplines compounded over 365 days create a massive chasm between you and the average person.",
  "Be proud of the grind. The late nights, the tight budgets, the hard concepts—this is the pressure that shapes character.",
  "Stop treating your goals like a hobby. Treat them like a mission that has no option for failure.",
  "You don't need to see the entire staircase to take the first step. Focus entirely on conquering the next 60 minutes.",
  "The hardest part is just starting. Once you open the editor, the book, or the script, momentum takes care of the rest.",
  "Comfort is the enemy of progress. If your routine feels tight and challenging, it means you are actively expanding your limits.",
  "The only validation that matters is looking in the mirror at night and knowing you gave everything you had to the day.",
  "Work hard in silence. Let your executed projects and your results do the talking for you.",
  "You did not come this far just to come this far. Keep pushing, keep solving, keep executing.",
  "If you want what the average person cannot achieve, you must be willing to endure what the average person cannot tolerate.",
  "Do not complain about the workload. Be thankful for the capacity to handle heavy things and build your professional leverage.",
  "Your current struggle is not permanent. It is the necessary training ground for the position you will hold tomorrow.",
  "Stop waiting for conditions to be perfect. The true professional executes flawlessly when resources are low and energy is depleted.",
  "Nobody is coming to do the heavy lifting for you. It's your name on the degree, your name on the project, and your life on the line.",
  "Let your absolute silence and crushing execution do the talking. The average talk; the elite build.",
  "The comfort zone is a beautiful place, but absolutely nothing ever grows there. Step into the friction.",
  "When you feel like quitting, remember why you started this journey in the first place. Don't betray your own vision.",
  "Failing a test or hitting a bug isn't the end. It's just data telling you where to optimize your strategy next time.",
  "Your daily routine is the only true predictor of your future. Show me your schedule and I will show you your trajectory.",
  "Uncommon discipline produces uncommon freedom. Pay the price upfront so you can own your time later.",
  "The hours you spend grinding in obscurity when nobody is watching are the exact hours that define your public success.",
  "Do it tired. Do it broke. Do it when you're frustrated. True consistency doesn't care about your temporary mood.",
  "Every single master was once a complete amateur who simply refused to quit when things became incredibly complex.",
  "You are entirely responsible for your own education. The lecture hall gives you the map, but you have to walk the terrain.",
  "Excuses are tools of incompetence used to build monuments of absolutely nothing. Drop the narrative and execute.",
  "Don't look at how far you still have to go. Focus entirely on executing the immediate task in front of you with maximum precision.",
  "The pain of self-discipline weighs ounces, while the crushing weight of regret weighs literal tons. Choose your burden wisely.",
  "Your brain is an adaptive machine. The more complex problems you throw at it, the more powerful it physically becomes.",
  "The grind isn't supposed to be easy. If it were easy, everyone would do it and the reward would be completely worthless.",
  "Do not pray for an easy life; pray for the strength to endure a difficult one. The struggle is where your value is created.",
  "The crowd is comfortable with average. If you want extraordinary results, you must accept the loneliness of high performance.",
  "Every hour you spend masterfully refining your craft when no one is watching is an investment that will pay dividends for decades.",
  "Stop waiting for a spark of inspiration. Discipline is showing up every single day and doing the work regardless of how you feel.",
  "Your background or current financial limits do not define your trajectory. Your daily execution and work ethic do.",
  "Excuses are nothing more than a soft pillow for a lazy mind. Throw the pillow away and face the hard ground of reality.",
  "The mountain looks intimidating from the bottom, but the view from the peak is reserved only for those who did not stop climbing.",
  "If you tire, learn to rest, not to quit. The journey is long, but the destination is worth every single drop of sweat.",
  "When you feel like giving up, think about how sweet it will feel to look back and say, 'I had every reason to quit, but I didn't.'",
  "Success is not a random lottery. It is the natural, inevitable byproduct of relentless daily compounding habits.",
  "You are the author of your own story. Do not let temporary setbacks write the final chapter of your potential.",
  "Stop talking about what you plan to build, what you plan to study, or what you plan to do. Just execute and show the results.",
  "The pain of hard work lasts for a short moment, but the pride of achieving your goals stays with you forever.",
  "No one ever built an empire by staying in bed. Wake up, get dressed, step out, and attack your schedule with purpose.",
  "You have the exact same 24 hours as the people you admire. The only difference is what they choose to sacrifice during those hours.",
  "When your mind tells you that you are completely done, you are actually only at 40% of your true physical and mental capacity.",
  "If it were easy, everyone would have a perfect GPA and a thriving business. The difficulty is the barrier that keeps the average out.",
  "Be obsessed with your personal growth. Let your progress be so rapid and consistent that people have to re-introduce themselves to you.",
  "Every hard line of code you debug, every complex math problem you solve, is a brick laid in the foundation of your future freedom.",
  "Your potential is a terrible thing to waste. Rise up to the level of your vision and refuse to settle for mediocrity."
];

const CLASS_BANNER_MASENO_TIPS = [
  "Maseno sits right on the Equator line. The heat is no joke—always carry a bottle of water if you're trekking between complex halls.",
  "Got a back-to-back class moving from Siriba Campus to College Campus (or vice versa)? Factor in the walking time across the highway and don't sprint on an empty stomach.",
  "Keep your umbrella or jacket in your bag. Maseno weather can change from scorching hot equator sun to a sudden downpour in minutes.",
  "Need a quiet, optimized study session? Skip the noisy student centers and head deep into the library stacks early before seats fill up.",
  "If your budget is tight and your schedule is packed, the local 'vibandaski' right outside the campus gates offer the fastest, most pocket-friendly fuel.",
  "The network connectivity can fluctuate during peak hours near major lecture halls. Download your lecture notes and reference PDFs to your device early in the morning.",
  "Avoid the long lunch rushes at the main student mess halls by timing your eating windows 15 minutes before or 30 minutes after standard lecture release times.",
  "Familiarize yourself with the smaller shortcut pathways behind the administrative blocks—they save valuable steps during hot afternoons.",
  "Make sure your laptop and phones are fully charged overnight; equator thunderstorms can sometimes lead to unexpected, brief power fluctuations on campus.",
  "Treat the non-teaching staff and lab technicians with extreme respect. They hold the keys to the resources, keys to rooms, and can save you in tight academic situations.",
  "When doing revisions for engineering, computer science, or advanced mathematics, form small, disciplined 3-person groups. Explaining a problem out loud locks down your own understanding.",
  "Don't wait until exam week to clear your fees invoices or check portal alignments. Do it early in the semester when the administration lines are empty.",
  "Keep an eye out for notice boards around the department blocks weekly. Sometimes venue adjustments or makeup classes are pinned physically before updating online.",
  "If you find an empty, open classroom during off-hours, claim it with your friends immediately for a private group-study session before a group project deadline.",
  "Keep a digital backup of your student ID and fee receipts saved on cloud storage or your phone. If you misplace a physical copy, a verified digital fallback keeps your momentum alive.",
  "The equatorial downpours don't give warnings. Keep a compact umbrella stowed at the absolute bottom of your backpack every single day.",
  "If you have an early morning lab at the College Campus, set your alarm 15 minutes earlier to handle the morning walking traffic across the highway safety lines.",
  "Keep digital scans of your official bank slips and registration details clear and organized in an offline folder on your phone for quick verification checks.",
  "The library basements or upper back corners are prime zones for deep, uninterrupted technical study away from high-traffic campus pathways.",
  "Don't rely heavily on the public campus Wi-Fi network during peak midday hours for critical online tests or system submissions; have a backup mobile data plan ready.",
  "Get to know the specific lab technicians in your department. Respecting their space means smoother project testing sessions later in the semester.",
  "The fastest way to burn through your student budget is buying trendy snacks daily. Utilize the local markets outside campus gates for fresh, affordable provisions.",
  "When moving between Siriba and College halls during hot afternoons, seek out the shaded pathways behind the older administrative blocks to stay cool.",
  "Always confirm your lecture venue allocations physically early on Monday mornings. Venues can occasionally shift without sudden portal notifications.",
  "Never leave your laptop, smartphone, or project notebooks unattended on library or mess hall tables for even a brief minute.",
  "Form a solid, reliable academic circle of 3 or 4 peers early. Sharing the load of researching complex topics saves immense time during exam prep.",
  "Clear your official fees statements and handle invoice alignments at the finance desks during the quiet mid-semester weeks when there are zero queues.",
  "The local print shops right outside the main gates offer fast document formatting and binding services when university facilities are packed.",
  "Keep a small power bank fully charged in your bag. Long days moving between different campus blocks can drain your phone battery rapidly.",
  "If you miss a lecture due to an emergency, don't just ask for notes. Find out exactly what practical problems or assignments were discussed out loud.",
  "Label your personal electronics, adapter plugs, and technical reference books clearly to avoid mix-ups during busy group study sessions.",
  "Take advantage of the open, green campus spaces early in the morning for fresh-air reading before the heat of the equatorial sun picks up.",
  "Learn the exact operational hours of the main administrative desks so you don't waste time walking over when they are closed for processing breaks.",
  "Keep your student portal login details completely secure. Never save credentials on shared lab computers or public browsing devices.",
  "A polite, professional approach goes an incredibly long way when dealing with department heads or administrative staff regarding system rectifications.",
  "If you're using the library during peak exam season, arrive 20 minutes before opening time to secure a desk near a functional power outlet.",
  "The heat at the Equator can make you feel drained by midday. Keep a small packet of glucose or some fresh fruit in your bag for an instant energy boost.",
  "Get to know the local boda-boda riders or coordinate your movements with peers to save on transport costs when moving off-campus late.",
  "Keep your academic documents organized in labeled folders on your cloud drive. You never know when you'll need to reference a receipt or transcript on the go.",
  "The student mess halls are cheapest, but if you need a quiet environment to discuss a project over a meal, explore the smaller eateries just off-campus.",
  "Always charge your electronics to 100% before major storms. Equator rains occasionally come with brief power grid maintenance downtime.",
  "If you have administrative issues at the registry, go there early on Tuesday or Thursday mornings when the queues are statistically shortest.",
  "Keep a spare notebook or a digital note app dedicated solely to tracking assignment deadlines so you don't get caught off guard by sudden submissions.",
  "For group projects, assign clear tasks and deadlines to each member on day one. Don't carry the weight of passive members on your own shoulders.",
  "When revising complex subjects like statistics or database structures, practice by drawing the entity relationships on a whiteboard or paper.",
  "The campus clinics are there for you. Don't ignore a rising fever or persistent headache; get checked early before it affects your study schedule.",
  "Learn the shortcuts between the main lecture halls and the science labs to avoid the heavy foot traffic along the main pathways during class transitions.",
  "Keep your student portal password unique and do not share it. Your academic registration and fee status are highly sensitive records.",
  "Always print your examination cards at least a week before the exam period starts to avoid the chaotic, last-minute print shop queues.",
  "If you find a great, quiet study spot under the campus trees, use it. Studying in fresh air improves focus and reduces academic claustrophobia.",
  "Be highly proactive. If a lecturer hasn't uploaded slides or notes to the portal, select a representative to politely request them early in the week.",
  "Keep your accommodation key on a secure lanyard or key ring. Losing your keys after a long, exhausting day of classes is a major headache.",
  "Respect the local community and traders outside the campus gates. Building good relationships with them makes your off-campus stay much safer and friendlier.",
  "Utilize the early morning hours (5:00 AM to 7:00 AM) for deep coding or heavy reading. The campus is dead silent and your brain is fresh.",
  "Every successful student at Maseno knows that consistency beats cramming every single time. Do a little bit of work every day."
];

const CLASS_BANNER_FACTS = [
  "Did you know? Writing down your goals on paper increases the likelihood of achieving them by over 42% compared to just keeping them in your head.",
  "Did you know? The human brain can store roughly 2.5 petabytes of data—equivalent to three million hours of video processing power.",
  "Did you know? Learning a new programming language or solving abstract math models alters your brain's physical structure by creating new neural pathways.",
  "Did you know? The 'Pomodoro Technique' (25 minutes of absolute focus followed by a 5-minute break) works because it prevents cognitive fatigue.",
  "Did you know? Reading lines of text aloud transfers the information from short-term audio echo memory directly into structural long-term retention.",
  "Did you know? The first computer bug was an actual physical moth found trapped inside a relay of the Harvard Mark II computer in 1947.",
  "Did you know? Your brain processes visual information roughly 60,000 times faster than text data, which is why structural diagrams and charts speed up learning.",
  "Did you know? Taking a 10-to-20-minute power nap can completely reset your cognitive motor skills and mental alertness without making you feel groggy.",
  "Did you know? Git was created by Linus Torvalds in just two weeks in 2005 because he was frustrated with the existing version control tools for Linux development.",
  "Did you know? Multi-tasking doesn't actually exist; your brain is just rapidly switching focus between tasks, which drops overall cognitive efficiency by 40%.",
  "Did you know? The complex algorithms powering modern GPS navigation and data encryption rely entirely on foundational pure mathematics and prime numbers.",
  "Did you know? Teaching someone else a concept you just learned is the absolute fastest way to master it—this is known scientifically as the Feynman Technique.",
  "Did you know? The QWERTY keyboard layout was originally engineered to intentionally slow down typing speeds so old mechanical typewriter keys wouldn't jam.",
  "Did you know? Spending just 20 minutes outside in natural sunlight significantly boosts serotonin production, instantly enhancing mood and long-term stamina.",
  "Did you know? Regular bodyweight exercises like pushups and squats increase blood flow directly to the prefrontal cortex, enhancing executive decision-making.",
  "Did you know? The most widely used programming languages today were built to solve basic, repetitive automation problems encountered by individual engineers.",
  "Did you know? Reviewing your lecture notes within 24 hours of hearing them prevents your memory retention rate from dropping below 80%.",
  "Did you know? Drinking water during an examination has been statistically correlated with improved test performance due to increased oxygenation.",
  "Did you know? Python was named after the British comedy troupe 'Monty Python,' not the snake, because its creator wanted the language to feel fun to write.",
  "Did you know? Your brain consumes roughly 20% of your body's total energy budget daily, despite making up only 2% of your overall physical mass.",
  "Did you know? Breaking down a giant project or study block into tiny micro-tasks reduces initial execution friction and eliminates standard procrastination triggers.",
  "Did you know? The internet is powered by millions of lines of open-source software built, maintained, and shared entirely for free by independent developers.",
  "Did you know? The human attention span naturally cycles every 90 to 120 minutes, making short structural mental breaks essential for deep work blocks.",
  "Did you know? Consistent calisthenics routines don't just build muscle; they significantly strengthen bone density and neurological motor control.",
  "Did you know? Working in a completely clean, clutter-free physical space directly decreases cognitive load, allowing your brain to focus deeper on code or logic.",
  "Did you know? The fast-charging tech on modern phones works most efficiently for the first 50-80% of capacity; topping off that last 20% takes much longer to protect battery health.",
  "Did you know? Reading a physical book or an e-ink screen before bed improves sleep architecture significantly compared to looking at high-contrast blue-light smartphone screens.",
  "Did you know? Consistent code refactoring—cleaning up old, clunky working code—saves hundreds of development hours down the road by reducing technical debt.",
  "Did you know? Using meaningful, descriptive naming conventions for variables and functions acts as built-in documentation, making your codebase easily readable months later.",
  "Did you know? Restructuring your application into reusable components doesn't just keep your layout clean; it dramatically reduces memory overhead and compilation times.",
  "Did you know? Your long-term memory consolidates and organizes concepts while you sleep, meaning a solid sleep schedule is technically a vital part of your study routine.",
  "Did you know? The first compiler was invented by Grace Hopper in 1952, proving that machines could interpret written text into executable machine code.",
  "Did you know? Using standard semantic HTML tags (like article, section, nav) helps search engines crawl your web layouts faster and makes your tools accessible to screen readers.",
  "Did you know? Most modern tech solutions were originally simple MVPs (Minimum Viable Products) built to solve one specific, immediate local problem perfectly.",
  "Did you know? Making mistakes and debugging them actually helps you learn better than getting the solution right on the first try, because it builds deep problem-solving skills.",
  "Did you know? The concept of 'Zero' as an actual numerical value rather than just a blank placeholder was pioneered by ancient mathematicians around the 5th century.",
  "Did you know? Your brain's processing capacity increases when you study in different environments, as spatial variation creates stronger contextual memory anchors.",
  "Did you know? The first hard drive, created by IBM in 1956, weighed over a ton and could store only about 5 megabytes of data.",
  "Did you know? Compiling your code frequently in smaller blocks makes debugging 70% faster because it isolates layout syntax errors immediately.",
  "Did you know? Writing complex mathematical equations out by hand activates deep motor-sensory areas in your brain that typing simply cannot stimulate.",
  "Did you know? The Linux operating system, which runs the vast majority of the world's internet servers, was originally started as a small personal hobby project.",
  "Did you know? Taking a structural 10-minute walk after a heavy learning session helps your brain process, organize, and store that data more effectively.",
  "Did you know? The entire World Wide Web source code was released to the public for free in 1993, sparking the modern digital era.",
  "Did you know? Your prefrontal cortex—the area of your brain handling advanced programming, logic, and long-term planning—is not fully mature until age 25.",
  "Did you know? Regular bodyweight exercise increases the size of your hippocampus, the specific brain region directly responsible for verbal memory and learning.",
  "Did you know? Open-source software repositories on platforms like GitHub allow anyone to contribute to global tech infrastructure using a basic mobile setup or cloud editor.",
  "Did you know? Reading structural code out loud or explaining it to an inanimate object (Rubber Duck Debugging) helps your brain spot logic flaws instantly.",
  "Did you know? Standard smartphone fast-chargers operate dynamically, pushing maximum power from 0% to 80%, then slowing down drastically to save your battery cells.",
  "Did you know? The mathematical constant Pi (π) has been calculated to over 100 trillion decimal places, yet only about 39 digits are needed to calculate the volume of the observable universe accurately.",
  "Did you know? Consuming a small amount of dark chocolate or drinking water before a test boosts blood flow directly to the cerebral cortex, raising short-term focus.",
  "Did you know? The CSS structure you use to style your responsive website grids uses rendering engine optimizations that execute code millions of times per second.",
  "Did you know? Human memory retention drops by nearly 50% within an hour of learning something unless you actively review it or write down core summaries.",
  "Did you know? The primary programming language concepts used today were developed decades ago to automate complex mathematical operations on mainframe computers.",
  "Did you know? Using semantic HTML elements allows assistive technologies and search engine algorithms to parse your web applications significantly faster.",
  "Did you know? Taking breaks based on your natural focus limits prevents cognitive burnout and maintains your overall problem-solving efficiency throughout the day.",
  "Did you know? The world's first programmer was Ada Lovelace, an English mathematician who wrote the first algorithm intended for a machine in 1843.",
  "Did you know? The term 'database' was coined in the early 1960s to describe central storage systems developed for military and space research programs.",
  "Did you know? Your brain is more creative when you are tired, which is why some developers write their most innovative code late at night.",
  "Did you know? The first computer mouse was invented by Douglas Engelbart in 1964 and was carved out of a single block of wood.",
  "Did you know? Learning is highly state-dependent. If you study while drinking coffee, you will retrieve that information slightly better if you have caffeine in your system during the exam.",
  "Did you know? The 'Ctrl + C' and 'Ctrl + V' copy-paste commands were invented by computer scientist Larry Tesler in 1973 to speed up text editing.",
  "Did you know? Solving hard math problems physically strengthens the connections between your brain's left and right hemispheres, improving logical intuition.",
  "Did you know? The most popular open-source databases in the world, like PostgreSQL and MySQL, process billions of complex queries every single second.",
  "Did you know? Your brain's short-term memory can typically hold only about 4 to 7 pieces of information at once, which is why breaking complex code into functions is essential.",
  "Did you know? The first domain name ever registered was 'symbolics.com' on March 15, 1985.",
  "Did you know? Regular aerobic exercise increases the volume of gray matter in brain regions associated with cognitive control and operational focus.",
  "Did you know? Taking a 20-minute break after every 90 minutes of intense intellectual work matches your body's natural ultradian biological cycles.",
  "Did you know? The Python programming language was designed with a philosophy that emphasizes code readability, using clean indentation instead of curly braces.",
  "Did you know? Reading text on a screen is roughly 10% to 30% slower than reading the same text printed on high-quality physical paper.",
  "Did you know? The SQL language (Structured Query Language) was originally called SEQUEL and was developed at IBM in the early 1970s.",
  "Did you know? Your brain uses more energy during active concentration and problem-solving than your heart does while you are exercising.",
  "Did you know? The concept of responsive web design was popularized in 2010 to allow single websites to adapt seamlessly to any screen size, from desktop to mobile.",
  "Did you know? Writing down your study notes in your own words instead of copying slides verbatim forces your brain to actively process and digest the concepts.",
  "Did you know? The first electronic general-purpose computer, ENIAC, took up an entire 30-by-50-foot room and weighed over 27 tons.",
  "Did you know? Taking a moment to organize your workspace before you start studying can reduce procrastination by lowering the visual clutter that drains your focus."
];

function _funnyPick(pool) { return pool[Math.floor(Math.random() * pool.length)]; }

function _classBannerScheduleStats(entries) {
if (!entries || !entries.length) return null;
const dayCounts = {};
entries.forEach(e => { dayCounts[e.day] = (dayCounts[e.day] || 0) + 1; });
const days = Object.keys(dayCounts);
const busiestDay = days.reduce((a, b) => dayCounts[a] >= dayCounts[b] ? a : b);
const earliest = Math.min(...entries.map(e => e.start));
const latest = Math.max(...entries.map(e => e.end));
const byDay = {};
entries.forEach(e => { (byDay[e.day] = byDay[e.day] || []).push(e); });
let backToBackDay = null;
let hugeGapDay = null;
Object.keys(byDay).forEach(day => {
const list = byDay[day].slice().sort((a, b) => a.start - b.start);
for (let i = 1; i < list.length; i++) {
const gap = list[i].start - list[i - 1].end;
if (gap <= 0.01 && !backToBackDay) backToBackDay = day;
if (gap >= 3 && !hugeGapDay) hugeGapDay = day;
}
});
const ALL_WEEK_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const freeDay = ALL_WEEK_DAYS.find(d => !dayCounts[d]);
const fridayLate = (byDay['Friday'] || []).some(e => e.start >= 15);
return { count: entries.length, busiestDay, busiestCount: dayCounts[busiestDay], earliest, latest, backToBackDay, freeDay, hugeGapDay, fridayLate };
}

function _classBannerComment(stats) {
if (!stats) return '';
let pool = [];
if (stats.backToBackDay) pool = pool.concat(CLASS_BANNER_COMMENTS.backToBack.map(t => t.replace('{day}', stats.backToBackDay)));
if (stats.earliest <= 7) pool = pool.concat(CLASS_BANNER_COMMENTS.earlyBird.map(t => t.replace('{time}', fmtHour(stats.earliest))));
if (stats.latest >= 19) pool = pool.concat(CLASS_BANNER_COMMENTS.lateNight.map(t => t.replace('{time}', fmtHour(stats.latest))));
if (stats.busiestCount >= 4) pool = pool.concat(CLASS_BANNER_COMMENTS.heavyDay.map(t => t.replace('{day}', stats.busiestDay).replace('{count}', stats.busiestCount)));
if (stats.freeDay) pool = pool.concat(CLASS_BANNER_COMMENTS.freeDay.map(t => t.replace('{day}', stats.freeDay)));
if (stats.count <= 2) pool = pool.concat(CLASS_BANNER_COMMENTS.lightLoad.map(t => t.replace('{count}', stats.count)));
if (stats.count >= 8) pool = pool.concat(CLASS_BANNER_COMMENTS.heavyLoad.map(t => t.replace('{count}', stats.count)));
if (!pool.length) pool = CLASS_BANNER_COMMENTS.generic;
return _funnyPick(pool);
}

function _classBannerJoke(stats) {
let pool = [];
if (stats) {
if (stats.earliest <= 7) pool = pool.concat(CLASS_BANNER_JOKES_BY_CONDITION.earlyBird);
if (stats.hugeGapDay) pool = pool.concat(CLASS_BANNER_JOKES_BY_CONDITION.hugeGap);
if (stats.fridayLate) pool = pool.concat(CLASS_BANNER_JOKES_BY_CONDITION.fridayLate);
}
pool = pool.concat(CLASS_BANNER_JOKES_BY_CONDITION.generic, CLASS_BANNER_JOKES);
return _funnyPick(pool);
}

function generateClassBanner(entries, opts = {}) {
const stats = _classBannerScheduleStats(entries);
const only = opts.only || null;
const want = (name) => !only || only.includes(name);
const categories = [];
if (want('comment')) categories.push({ emoji: '😉', text: _classBannerComment(stats) });
if (want('joke') && opts.includeJokes !== false) categories.push({ emoji: '😂', text: _classBannerJoke(stats) });
if (want('health') && CLASS_BANNER_HEALTH_TIPS.length) categories.push({ emoji: '💡', text: _funnyPick(CLASS_BANNER_HEALTH_TIPS) });
if (want('quote') && CLASS_BANNER_QUOTES.length) categories.push({ emoji: '✨', text: _funnyPick(CLASS_BANNER_QUOTES) });
if (want('motivation') && CLASS_BANNER_MOTIVATION.length) categories.push({ emoji: '🔥', text: _funnyPick(CLASS_BANNER_MOTIVATION) });
if (want('masenoTip') && CLASS_BANNER_MASENO_TIPS.length) categories.push({ emoji: '📍', text: _funnyPick(CLASS_BANNER_MASENO_TIPS) });
if (want('fact') && CLASS_BANNER_FACTS.length) categories.push({ emoji: '🧠', text: _funnyPick(CLASS_BANNER_FACTS) });
const picked = _funnyPick(categories);
return picked.text ? `${picked.emoji} ${picked.text}` : '';
}

function renderFunnyComment(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (msg) { el.textContent = msg; el.style.display = 'block'; }
  else { el.textContent = ''; el.style.display = 'none'; }
}
