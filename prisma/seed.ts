import { PrismaClient, ContentType, ContentStatus, SubscriptionTier, AchievementCategory, AchievementTier, StoryMood, StoryCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// IMPORTANT: Change this password before running in production!
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || 'ChangeThisPassword123!';

async function main() {
  console.log('🌱 Seeding database...');

  // Hash the admin password
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  
  if (!process.env.ADMIN_SEED_PASSWORD) {
    console.warn('⚠️  WARNING: Using default admin password. Set ADMIN_SEED_PASSWORD env var for production!');
  }

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@restorae.com' },
    update: {},
    create: {
      email: 'admin@restorae.com',
      name: 'Admin User',
      role: 'ADMIN',
      isActive: true,
      onboardingCompleted: true,
      passwordHash: adminPasswordHash,
      preferences: {
        create: {
          theme: 'system',
          soundsEnabled: true,
          hapticsEnabled: true,
        },
      },
      subscription: {
        create: {
          tier: SubscriptionTier.LIFETIME,
        },
      },
    },
  });

  console.log('✅ Created admin user:', admin.email);

  // =========================================================================
  // BREATHING EXERCISES (Target: ~40 items)
  // =========================================================================
  const breathingBase = [
    { name: 'Box Breathing', icon: '📦', duration: '240', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-white-and-grey-shapes-loop-42289-large.mp4', data: { inhale: 4, hold: 4, exhale: 4, holdAfterExhale: 4, rounds: 4 } },
    { name: '4-7-8 Relax', icon: '😴', duration: '180', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-1610-large.mp4', data: { inhale: 4, hold: 7, exhale: 8, rounds: 3 } },
    { name: 'Coherent Breathing', icon: '🌊', duration: '300', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-sea-waves-loop-1196-large.mp4', data: { inhale: 6, exhale: 6, rounds: 25 } },
    { name: 'Resonant Breath', icon: '🔔', duration: '600', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4', data: { inhale: 5, exhale: 5, rounds: 60 } },
    { name: 'Deep Calm', icon: '🧘', duration: '400', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fog-over-the-river-1225-large.mp4', data: { inhale: 5, hold: 2, exhale: 7, rounds: 10 } },
    { name: 'Morning Energy', icon: '☀️', duration: '120', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-sun-rays-in-a-forest-1189-large.mp4', data: { inhale: 4, exhale: 2, rounds: 20 } },
    { name: 'Sleep Onset', icon: '🌙', duration: '480', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-starry-sky-loop-1609-large.mp4', data: { inhale: 4, hold: 7, exhale: 8, rounds: 8 } },
    { name: 'Anxiety SOS', icon: '🆘', duration: '60', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-ink-swirling-in-water-1335-large.mp4', data: { inhale: 3, hold: 3, exhale: 3, rounds: 6 } },
    { name: 'Focus Breath', icon: '🎯', duration: '300', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-bubbles-rising-in-water-1360-large.mp4', data: { inhale: 4, hold: 2, exhale: 4, rounds: 15 } },
    { name: 'Lion\'s Breath', icon: '🦁', duration: '180', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fire-burning-loop-1393-large.mp4', data: { inhale: 5, exhale: 5, forcedExhale: true } },
  ];

  const levels = ['Level I', 'Level II', 'Level III', 'Guide'];
  const breathingExercises: any[] = [];
  let bOrder = 1;

  // Generate permutations
  breathingBase.forEach((base) => {
    levels.forEach((level, idx) => {
      const isPremium = idx > 0; // Level 1 is free, others premium
      const slug = `${base.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${level.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      
      breathingExercises.push({
        slug,
        name: `${base.name} - ${level}`,
        description: `A ${level} variation of the ${base.name} technique.`,
        type: ContentType.BREATHING,
        category: 'stress-relief',
        duration: base.duration,
        isPremium,
        status: ContentStatus.PUBLISHED,
        data: base.data,
        icon: base.icon,
        videoUrl: base.videoUrl, // Add video URL
        bestFor: 'Stress relief, Focus, Anxiety',
        tags: ['breathing', level.toLowerCase()],
        order: bOrder++,
      });
    });
  });

  for (const exercise of breathingExercises) {
    await prisma.contentItem.upsert({
      where: { slug: exercise.slug },
      update: exercise,
      create: exercise,
    });
  }

  console.log(`✅ Created ${breathingExercises.length} breathing exercises`);

  // =========================================================================
  // GROUNDING TECHNIQUES (Target: ~40 items)
  // =========================================================================
  const groundingBase = [
    { name: '5-4-3-2-1 Senses', icon: '👁️', desc: 'Identify 5 things you see, 4 feel, 3 hear...', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4' },
    { name: 'Body Scan', icon: '🧘', desc: 'Slowly scan your body from head to toe.', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-white-and-grey-shapes-loop-42289-large.mp4' },
    { name: 'Rooted Tree', icon: '🌳', desc: 'Feel your feet visualizing roots into the earth.', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-leaves-of-a-tree-in-autumn-1199-large.mp4' },
    { name: 'Cold Water', icon: '💧', desc: 'Splash cold water on your face/wrists.', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fresh-water-flowing-in-a-river-1186-large.mp4' },
    { name: 'Texture Touch', icon: '🧶', desc: 'Focus intensely on the texture of an object.', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-macro-shot-of-a-plant-leaf-1153-large.mp4' },
    { name: 'Mental Math', icon: '🧮', desc: 'Count backward from 100 by 7s.', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-technology-grid-loop-2117-large.mp4' },
    { name: 'Color Spotting', icon: '🎨', desc: 'Find 5 blue objects in the room.', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-color-swirl-loop-42287-large.mp4' },
    { name: 'Feet on Floor', icon: '👣', desc: 'Stomp feet to feel connection to ground.', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-feet-walking-on-grass-1191-large.mp4' },
    { name: 'Object Focus', icon: '🔍', desc: 'Describe an object in microscopic detail.', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-macro-shot-of-a-flower-1182-large.mp4' },
    { name: 'Deep Release', icon: '🌬️', desc: 'Tense and release muscle groups.', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-stretching-arms-at-sunset-1188-large.mp4' },
  ];

  const groundingVariations = ['Quick', 'Guided', 'Deep', 'Silent'];
  const groundingTechniques: any[] = [];
  let gOrder = 1;

  groundingBase.forEach((base) => {
    groundingVariations.forEach((variant, idx) => {
      const isPremium = idx > 1; // First 2 free
      const slug = `${base.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${variant.toLowerCase()}`;
      
      groundingTechniques.push({
        slug,
        name: `${base.name} (${variant})`,
        description: base.desc,
        type: ContentType.GROUNDING,
        category: 'anxiety',
        duration: '300',
        isPremium,
        status: ContentStatus.PUBLISHED,
        data: { steps: ['Step 1: Preparation', 'Step 2: Action', 'Step 3: Reflection'] },
        icon: base.icon,
        videoUrl: base.videoUrl, // Add video URL
        bestFor: 'Anxiety, Panic, Grounding',
        tags: ['grounding', variant.toLowerCase()],
        order: gOrder++,
      });
    });
  });

  for (const technique of groundingTechniques) {
    await prisma.contentItem.upsert({
      where: { slug: technique.slug },
      update: technique,
      create: technique,
    });
  }

  console.log(`✅ Created ${groundingTechniques.length} grounding techniques`);



  // Seed journal prompts
  const journalPrompts = [
    {
      slug: 'gratitude-three',
      name: 'Three Things I\'m Grateful For',
      description: 'Focus on the positive aspects of your day',
      type: ContentType.PROMPT,
      category: 'gratitude',
      isPremium: false,
      status: ContentStatus.PUBLISHED,
      data: {
        prompt: 'List three things you\'re grateful for today and why they matter to you.',
      },
      icon: '🙏',
      bestFor: 'Gratitude, Positivity',
      tags: ['daily', 'beginner'],
      order: 1,
    },
    {
      slug: 'reflection-day',
      name: 'Daily Reflection',
      description: 'Reflect on your day and emotions',
      type: ContentType.PROMPT,
      category: 'reflection',
      isPremium: false,
      status: ContentStatus.PUBLISHED,
      data: {
        prompt: 'How did you feel today? What went well? What could have been better?',
      },
      icon: '💭',
      bestFor: 'Reflection, Self-awareness',
      tags: ['daily', 'evening'],
      order: 2,
    },
  ];

  for (const prompt of journalPrompts) {
    await prisma.contentItem.upsert({
      where: { slug: prompt.slug },
      update: prompt,
      create: prompt,
    });
  }

  console.log('✅ Created journal prompts');

  // Seed FAQs
  const faqs = [
    {
      question: 'How do I start a free trial?',
      answer: 'You can start your 7-day free trial from the Premium tab. No credit card required!',
      category: 'subscription',
      order: 1,
      isActive: true,
    },
    {
      question: 'Is my data private and secure?',
      answer: 'Yes! All your journal entries and mood data are encrypted and stored securely. We never share your personal data with third parties.',
      category: 'privacy',
      order: 2,
      isActive: true,
    },
    {
      question: 'Can I export my data?',
      answer: 'Absolutely! You can export all your data at any time from Settings > Data & Privacy.',
      category: 'data',
      order: 3,
      isActive: true,
    },
  ];

  for (const faq of faqs) {
    await prisma.fAQ.create({
      data: faq,
    });
  }

  console.log('✅ Created FAQs');

  // Seed system config
  await prisma.systemConfig.upsert({
    where: { key: 'trial_duration_days' },
    update: { value: '7' },
    create: {
      key: 'trial_duration_days',
      value: '7',
    },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'max_mood_entries_free' },
    update: { value: '30' },
    create: {
      key: 'max_mood_entries_free',
      value: '30',
    },
  });

  console.log('✅ Created system config');

  // =========================================================================
  // BEDTIME STORIES (Target: ~25 stories)
  // StoryCategory is an enum, not a model, so we use it directly
  // =========================================================================
  const bedtimeStories = [
    // Nature stories
    { slug: 'moonlit-meadow', title: 'The Moonlit Meadow', subtitle: 'A peaceful journey through night gardens', description: 'Drift into peaceful slumber as you wander through a moonlit meadow filled with fireflies and gentle breezes.', narrator: 'Sarah Williams', duration: 30, audioUrl: '', category: StoryCategory.NATURE, tags: ['nature', 'peaceful', 'meadow'], mood: StoryMood.CALM, isPremium: false, order: 1, status: ContentStatus.PUBLISHED },
    { slug: 'forest-rain', title: 'Rain in the Forest', subtitle: 'Listen to gentle raindrops on leaves', description: 'Experience the soothing sounds of rain falling softly on a canopy of leaves in a serene forest.', narrator: 'James Harper', duration: 40, audioUrl: '', category: StoryCategory.NATURE, tags: ['nature', 'rain', 'forest'], mood: StoryMood.CALM, isPremium: true, order: 2, status: ContentStatus.PUBLISHED },
    { slug: 'mountain-stream', title: 'The Mountain Stream', subtitle: 'Follow water down the mountainside', description: 'Journey alongside a crystal-clear mountain stream as it winds its way through alpine meadows.', narrator: 'Emily Chen', duration: 25, audioUrl: '', category: StoryCategory.NATURE, tags: ['nature', 'water', 'mountain'], mood: StoryMood.DREAMY, isPremium: false, order: 3, status: ContentStatus.PUBLISHED },
    { slug: 'ocean-shore', title: 'By the Ocean Shore', subtitle: 'Waves gently lap at the sandy beach', description: 'Feel the warm sand beneath you as gentle waves whisper their eternal lullaby.', narrator: 'David Moore', duration: 35, audioUrl: '', category: StoryCategory.NATURE, tags: ['nature', 'ocean', 'beach'], mood: StoryMood.CALM, isPremium: true, order: 4, status: ContentStatus.PUBLISHED },
    { slug: 'autumn-leaves', title: 'Autumn Leaves Falling', subtitle: 'Watch the golden leaves drift down', description: 'Witness the gentle ballet of autumn leaves as they twirl and dance to the ground.', narrator: 'Sarah Williams', duration: 20, audioUrl: '', category: StoryCategory.NATURE, tags: ['nature', 'autumn', 'leaves'], mood: StoryMood.COZY, isPremium: false, order: 5, status: ContentStatus.PUBLISHED },

    // Travel stories
    { slug: 'train-to-alps', title: 'Night Train to the Alps', subtitle: 'A gentle journey through sleeping villages', description: 'Board a cozy night train as it winds through moonlit valleys and sleeping alpine villages.', narrator: 'Thomas Berg', duration: 45, audioUrl: '', category: StoryCategory.TRAVEL, tags: ['travel', 'train', 'alps'], mood: StoryMood.COZY, isPremium: true, order: 1, status: ContentStatus.PUBLISHED },
    { slug: 'tuscan-villa', title: 'Evening at the Tuscan Villa', subtitle: 'Dinner under the stars in Italy', description: 'Spend a peaceful evening at a sun-warmed Tuscan villa with cypress trees swaying gently.', narrator: 'Maria Romano', duration: 30, audioUrl: '', category: StoryCategory.TRAVEL, tags: ['travel', 'italy', 'villa'], mood: StoryMood.COZY, isPremium: false, order: 2, status: ContentStatus.PUBLISHED },
    { slug: 'japanese-garden', title: 'The Japanese Garden', subtitle: 'Peace in an ancient Kyoto garden', description: 'Find serenity in an ancient Japanese garden where koi swim lazily and bamboo whispers.', narrator: 'Yuki Tanaka', duration: 35, audioUrl: '', category: StoryCategory.TRAVEL, tags: ['travel', 'japan', 'garden'], mood: StoryMood.CALM, isPremium: true, order: 3, status: ContentStatus.PUBLISHED },
    { slug: 'lighthouse-keeper', title: 'The Lighthouse Keeper', subtitle: 'A quiet night on the Maine coast', description: 'Join an old lighthouse keeper as he shares tales of the sea on a peaceful Maine evening.', narrator: 'James Harper', duration: 40, audioUrl: '', category: StoryCategory.TRAVEL, tags: ['travel', 'lighthouse', 'coast'], mood: StoryMood.CALM, isPremium: true, order: 4, status: ContentStatus.PUBLISHED },
    { slug: 'parisian-cafe', title: 'A Parisian Café', subtitle: 'Evening in the City of Lights', description: 'Sit at a quiet corner café in Paris as the city settles into a peaceful evening.', narrator: 'Sophie Laurent', duration: 25, audioUrl: '', category: StoryCategory.TRAVEL, tags: ['travel', 'paris', 'cafe'], mood: StoryMood.COZY, isPremium: false, order: 5, status: ContentStatus.PUBLISHED },

    // Fantasy stories
    { slug: 'enchanted-library', title: 'The Enchanted Library', subtitle: 'Books that whisper ancient tales', description: 'Discover a magical library where books float and whisper stories of distant lands.', narrator: 'Emily Chen', duration: 35, audioUrl: '', category: StoryCategory.FANTASY, tags: ['fantasy', 'library', 'magic'], mood: StoryMood.MAGICAL, isPremium: true, order: 1, status: ContentStatus.PUBLISHED },
    { slug: 'cloud-kingdom', title: 'Kingdom in the Clouds', subtitle: 'A floating castle above the world', description: 'Float up to a gentle kingdom made of clouds where everything moves in peaceful slow motion.', narrator: 'Sarah Williams', duration: 30, audioUrl: '', category: StoryCategory.FANTASY, tags: ['fantasy', 'clouds', 'kingdom'], mood: StoryMood.MAGICAL, isPremium: false, order: 2, status: ContentStatus.PUBLISHED },
    { slug: 'starlight-garden', title: 'The Starlight Garden', subtitle: 'Flowers that bloom only by starlight', description: 'Visit a secret garden where luminescent flowers bloom only under the gentle light of stars.', narrator: 'David Moore', duration: 40, audioUrl: '', category: StoryCategory.FANTASY, tags: ['fantasy', 'garden', 'stars'], mood: StoryMood.DREAMY, isPremium: true, order: 3, status: ContentStatus.PUBLISHED },
    { slug: 'sleeping-dragon', title: 'The Sleeping Dragon', subtitle: 'A gentle giant guards your dreams', description: 'Meet a friendly dragon who guards the realm of dreams and keeps nightmares away.', narrator: 'James Harper', duration: 25, audioUrl: '', category: StoryCategory.FANTASY, tags: ['fantasy', 'dragon', 'dreams'], mood: StoryMood.MAGICAL, isPremium: false, order: 4, status: ContentStatus.PUBLISHED },
    { slug: 'moonstone-forest', title: 'The Moonstone Forest', subtitle: 'Trees made of crystal and light', description: 'Wander through a forest of crystal trees that glow softly with captured moonlight.', narrator: 'Emily Chen', duration: 45, audioUrl: '', category: StoryCategory.FANTASY, tags: ['fantasy', 'forest', 'moonstone'], mood: StoryMood.DREAMY, isPremium: true, order: 5, status: ContentStatus.PUBLISHED },

    // Meditation stories
    { slug: 'body-scan-journey', title: 'Body Scan Journey', subtitle: 'Release tension from head to toe', description: 'A gentle guided journey through your body, releasing tension and inviting deep relaxation.', narrator: 'Dr. Lisa Chen', duration: 20, audioUrl: '', category: StoryCategory.MEDITATION, tags: ['meditation', 'body-scan', 'relaxation'], mood: StoryMood.CALM, isPremium: false, order: 1, status: ContentStatus.PUBLISHED },
    { slug: 'breath-awareness', title: 'Breath Awareness', subtitle: 'Find peace in your breath', description: 'Connect with the natural rhythm of your breath and let it guide you to peaceful sleep.', narrator: 'Dr. Michael Gray', duration: 15, audioUrl: '', category: StoryCategory.MEDITATION, tags: ['meditation', 'breath', 'awareness'], mood: StoryMood.CALM, isPremium: false, order: 2, status: ContentStatus.PUBLISHED },
    { slug: 'letting-go', title: 'Letting Go', subtitle: 'Release what no longer serves you', description: 'A meditation to help you release the day\'s worries and drift into restful sleep.', narrator: 'Dr. Lisa Chen', duration: 25, audioUrl: '', category: StoryCategory.MEDITATION, tags: ['meditation', 'release', 'peace'], mood: StoryMood.CALM, isPremium: true, order: 3, status: ContentStatus.PUBLISHED },
    { slug: 'gratitude-reflection', title: 'Gratitude Reflection', subtitle: 'End your day with thankfulness', description: 'Reflect on the blessings of your day and fill your heart with gratitude before sleep.', narrator: 'Sarah Williams', duration: 20, audioUrl: '', category: StoryCategory.MEDITATION, tags: ['meditation', 'gratitude', 'reflection'], mood: StoryMood.COZY, isPremium: false, order: 4, status: ContentStatus.PUBLISHED },
    { slug: 'healing-light', title: 'Healing Light', subtitle: 'Warm golden light fills your being', description: 'Visualize warm, healing light flowing through every part of your body.', narrator: 'Dr. Michael Gray', duration: 30, audioUrl: '', category: StoryCategory.MEDITATION, tags: ['meditation', 'healing', 'visualization'], mood: StoryMood.MAGICAL, isPremium: true, order: 5, status: ContentStatus.PUBLISHED },

    // Soundscapes
    { slug: 'rainy-window', title: 'Rainy Window', subtitle: 'Rain against your bedroom window', description: 'The gentle patter of rain against your window creates the perfect backdrop for sleep.', narrator: 'Ambient', duration: 60, audioUrl: '', category: StoryCategory.SOUNDSCAPES, tags: ['soundscape', 'rain', 'ambient'], mood: StoryMood.COZY, isPremium: false, order: 1, status: ContentStatus.PUBLISHED },
    { slug: 'distant-thunder', title: 'Distant Thunder', subtitle: 'A gentle storm far away', description: 'Listen to the comforting rumble of distant thunder as a storm passes safely by.', narrator: 'Ambient', duration: 60, audioUrl: '', category: StoryCategory.SOUNDSCAPES, tags: ['soundscape', 'thunder', 'storm'], mood: StoryMood.DREAMY, isPremium: true, order: 2, status: ContentStatus.PUBLISHED },
    { slug: 'crackling-fire', title: 'Crackling Fireplace', subtitle: 'A warm fire on a cold night', description: 'The warm crackle and pop of a cozy fireplace invites you to drift off peacefully.', narrator: 'Ambient', duration: 60, audioUrl: '', category: StoryCategory.SOUNDSCAPES, tags: ['soundscape', 'fire', 'cozy'], mood: StoryMood.COZY, isPremium: false, order: 3, status: ContentStatus.PUBLISHED },

    // Classics
    { slug: 'wind-willows', title: 'The Wind in the Willows', subtitle: 'Classic tale of Mole and Ratty', description: 'A soothing retelling of the beloved tale of Mole, Ratty, and their riverside adventures.', narrator: 'James Harper', duration: 45, audioUrl: '', category: StoryCategory.CLASSICS, tags: ['classic', 'literary', 'adventure'], mood: StoryMood.COZY, isPremium: true, order: 1, status: ContentStatus.PUBLISHED },
    { slug: 'secret-garden', title: 'The Secret Garden', subtitle: 'Mary discovers a hidden world', description: 'Join Mary as she discovers a secret garden and the magic within.', narrator: 'Emily Chen', duration: 50, audioUrl: '', category: StoryCategory.CLASSICS, tags: ['classic', 'literary', 'garden'], mood: StoryMood.MAGICAL, isPremium: true, order: 2, status: ContentStatus.PUBLISHED },
  ];

  for (const story of bedtimeStories) {
    await prisma.bedtimeStory.upsert({
      where: { slug: story.slug },
      update: story,
      create: story,
    });
  }

  console.log(`✅ Created ${bedtimeStories.length} bedtime stories`);

  // =========================================================================
  // ACHIEVEMENTS (Target: ~45 achievements)
  // Note: Achievement uses 'key' not 'slug', and requires 'title' and 'requirement'
  // =========================================================================
  const achievements = [
    // Session achievements
    { key: 'first-breath', title: 'First Breath', description: 'Complete your first breathing session', icon: '🌬️', category: AchievementCategory.SESSION, tier: AchievementTier.BRONZE, requirement: 1, xpReward: 25, order: 1 },
    { key: 'getting-started', title: 'Getting Started', description: 'Complete 10 sessions', icon: '🚀', category: AchievementCategory.SESSION, tier: AchievementTier.BRONZE, requirement: 10, xpReward: 50, order: 2 },
    { key: 'dedicated-practitioner', title: 'Dedicated Practitioner', description: 'Complete 50 sessions', icon: '🎖️', category: AchievementCategory.SESSION, tier: AchievementTier.SILVER, requirement: 50, xpReward: 100, order: 3 },
    { key: 'century-club', title: 'Century Club', description: 'Complete 100 sessions', icon: '💯', category: AchievementCategory.SESSION, tier: AchievementTier.GOLD, requirement: 100, xpReward: 200, order: 4 },
    { key: 'master-of-calm', title: 'Master of Calm', description: 'Complete 500 sessions', icon: '👑', category: AchievementCategory.SESSION, tier: AchievementTier.PLATINUM, requirement: 500, xpReward: 500, order: 5 },

    // Streak/Consistency achievements
    { key: 'three-day-streak', title: 'Three Day Streak', description: 'Practice for 3 days in a row', icon: '🔥', category: AchievementCategory.CONSISTENCY, tier: AchievementTier.BRONZE, requirement: 3, xpReward: 30, order: 1 },
    { key: 'week-warrior', title: 'Week Warrior', description: 'Practice for 7 days in a row', icon: '⚔️', category: AchievementCategory.CONSISTENCY, tier: AchievementTier.BRONZE, requirement: 7, xpReward: 75, order: 2 },
    { key: 'fortnight-fighter', title: 'Fortnight Fighter', description: 'Practice for 14 days in a row', icon: '🛡️', category: AchievementCategory.CONSISTENCY, tier: AchievementTier.SILVER, requirement: 14, xpReward: 150, order: 3 },
    { key: 'monthly-master', title: 'Monthly Master', description: 'Practice for 30 days in a row', icon: '🏆', category: AchievementCategory.CONSISTENCY, tier: AchievementTier.GOLD, requirement: 30, xpReward: 300, order: 4 },
    { key: 'century-streak', title: 'Century Streak', description: 'Practice for 100 days in a row', icon: '💎', category: AchievementCategory.CONSISTENCY, tier: AchievementTier.PLATINUM, requirement: 100, xpReward: 1000, order: 5 },
    { key: 'year-of-zen', title: 'Year of Zen', description: 'Practice for 365 days in a row', icon: '🌟', category: AchievementCategory.CONSISTENCY, tier: AchievementTier.PLATINUM, requirement: 365, xpReward: 5000, order: 6 },

    // Time/Mindfulness achievements
    { key: 'first-hour', title: 'First Hour', description: 'Spend 1 hour in total practice', icon: '⏱️', category: AchievementCategory.MINDFULNESS, tier: AchievementTier.BRONZE, requirement: 60, xpReward: 50, order: 1 },
    { key: 'ten-hours', title: 'Ten Hours', description: 'Spend 10 hours in total practice', icon: '⏰', category: AchievementCategory.MINDFULNESS, tier: AchievementTier.SILVER, requirement: 600, xpReward: 150, order: 2 },
    { key: 'hundred-hours', title: 'Hundred Hours', description: 'Spend 100 hours in total practice', icon: '🕰️', category: AchievementCategory.MINDFULNESS, tier: AchievementTier.GOLD, requirement: 6000, xpReward: 500, order: 3 },

    // Exploration achievements
    { key: 'curious-explorer', title: 'Curious Explorer', description: 'Try 5 different exercise types', icon: '🔍', category: AchievementCategory.EXPLORATION, tier: AchievementTier.BRONZE, requirement: 5, xpReward: 40, order: 1 },
    { key: 'adventurous-spirit', title: 'Adventurous Spirit', description: 'Try 10 different exercise types', icon: '🧭', category: AchievementCategory.EXPLORATION, tier: AchievementTier.SILVER, requirement: 10, xpReward: 100, order: 2 },
    { key: 'technique-collector', title: 'Technique Collector', description: 'Try 20 different exercises', icon: '📚', category: AchievementCategory.EXPLORATION, tier: AchievementTier.GOLD, requirement: 20, xpReward: 200, order: 3 },

    // Mastery achievements
    { key: 'breathing-apprentice', title: 'Breathing Apprentice', description: 'Complete 10 breathing sessions', icon: '🌊', category: AchievementCategory.MASTERY, tier: AchievementTier.BRONZE, requirement: 10, xpReward: 50, order: 1 },
    { key: 'grounding-expert', title: 'Grounding Expert', description: 'Complete 10 grounding sessions', icon: '🌱', category: AchievementCategory.MASTERY, tier: AchievementTier.BRONZE, requirement: 10, xpReward: 50, order: 2 },
    { key: 'focus-master', title: 'Focus Master', description: 'Complete 10 focus sessions', icon: '🎯', category: AchievementCategory.MASTERY, tier: AchievementTier.BRONZE, requirement: 10, xpReward: 50, order: 3 },
    { key: 'sleep-specialist', title: 'Sleep Specialist', description: 'Listen to 10 bedtime stories', icon: '😴', category: AchievementCategory.MASTERY, tier: AchievementTier.BRONZE, requirement: 10, xpReward: 50, order: 4 },
    { key: 'journal-journeyman', title: 'Journal Journeyman', description: 'Write 10 journal entries', icon: '📝', category: AchievementCategory.MASTERY, tier: AchievementTier.BRONZE, requirement: 10, xpReward: 50, order: 5 },
    { key: 'ritual-ritualist', title: 'Ritual Ritualist', description: 'Complete 10 morning or evening rituals', icon: '🌅', category: AchievementCategory.MASTERY, tier: AchievementTier.BRONZE, requirement: 10, xpReward: 50, order: 6 },

    // Special achievements
    { key: 'early-bird', title: 'Early Bird', description: 'Practice before 7am', icon: '🐦', category: AchievementCategory.SPECIAL, tier: AchievementTier.BRONZE, requirement: 1, xpReward: 25, order: 1 },
    { key: 'night-owl', title: 'Night Owl', description: 'Practice after 11pm', icon: '🦉', category: AchievementCategory.SPECIAL, tier: AchievementTier.BRONZE, requirement: 1, xpReward: 25, order: 2 },
    { key: 'weekend-warrior', title: 'Weekend Warrior', description: 'Practice on both Saturday and Sunday', icon: '🎉', category: AchievementCategory.SPECIAL, tier: AchievementTier.BRONZE, requirement: 1, xpReward: 30, order: 3 },
    { key: 'mood-tracker', title: 'Mood Tracker', description: 'Log your mood for 7 days', icon: '📊', category: AchievementCategory.SPECIAL, tier: AchievementTier.BRONZE, requirement: 7, xpReward: 40, order: 4 },
    { key: 'five-star-day', title: 'Five Star Day', description: 'Complete 5 different activities in one day', icon: '⭐', category: AchievementCategory.SPECIAL, tier: AchievementTier.SILVER, requirement: 5, xpReward: 100, order: 5 },
    { key: 'comeback-kid', title: 'Comeback Kid', description: 'Return after 30+ days away', icon: '🔄', category: AchievementCategory.SPECIAL, tier: AchievementTier.BRONZE, requirement: 1, xpReward: 50, order: 6 },
    { key: 'night-cap', title: 'Nightcap', description: 'Complete an evening ritual', icon: '🌙', category: AchievementCategory.SPECIAL, tier: AchievementTier.BRONZE, requirement: 1, xpReward: 20, order: 7 },
    { key: 'sunrise-session', title: 'Sunrise Session', description: 'Complete a morning ritual', icon: '🌅', category: AchievementCategory.SPECIAL, tier: AchievementTier.BRONZE, requirement: 1, xpReward: 20, order: 8 },

    // Premium/exploration achievements
    { key: 'premium-explorer', title: 'Premium Explorer', description: 'Try 5 premium exercises', icon: '💎', category: AchievementCategory.EXPLORATION, tier: AchievementTier.SILVER, requirement: 5, xpReward: 75, order: 10, isSecret: true },
    { key: 'story-time', title: 'Story Time', description: 'Complete your first bedtime story', icon: '📖', category: AchievementCategory.SESSION, tier: AchievementTier.BRONZE, requirement: 1, xpReward: 25, order: 10 },
    { key: 'storyteller', title: 'Storyteller', description: 'Listen to 25 bedtime stories', icon: '📚', category: AchievementCategory.MASTERY, tier: AchievementTier.SILVER, requirement: 25, xpReward: 100, order: 7 },
    { key: 'bibliophile', title: 'Bibliophile', description: 'Listen to 50 bedtime stories', icon: '🏛️', category: AchievementCategory.MASTERY, tier: AchievementTier.GOLD, requirement: 50, xpReward: 250, order: 8 },

    // Level achievements
    { key: 'level-5', title: 'Level 5', description: 'Reach level 5', icon: '5️⃣', category: AchievementCategory.SPECIAL, tier: AchievementTier.BRONZE, requirement: 5, xpReward: 50, order: 20 },
    { key: 'level-10', title: 'Level 10', description: 'Reach level 10', icon: '🔟', category: AchievementCategory.SPECIAL, tier: AchievementTier.SILVER, requirement: 10, xpReward: 100, order: 21 },
    { key: 'level-25', title: 'Level 25', description: 'Reach level 25', icon: '🎖️', category: AchievementCategory.SPECIAL, tier: AchievementTier.GOLD, requirement: 25, xpReward: 250, order: 22 },
    { key: 'level-50', title: 'Level 50', description: 'Reach max level 50', icon: '👑', category: AchievementCategory.SPECIAL, tier: AchievementTier.PLATINUM, requirement: 50, xpReward: 1000, order: 23 },

    // All achievements unlocked
    { key: 'completionist', title: 'Completionist', description: 'Unlock all achievements', icon: '🏅', category: AchievementCategory.SPECIAL, tier: AchievementTier.PLATINUM, requirement: 45, xpReward: 5000, order: 99, isSecret: true },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: achievement,
      create: achievement,
    });
  }

  console.log(`✅ Created ${achievements.length} achievements`);

  // =========================================================================
  // COACH MARKS (Onboarding tooltips)
  // Note: The schema doesn't have targetId - just screen, title, description, position, order
  // =========================================================================
  const coachMarks = [
    // Home screen
    { key: 'home-for-you', screen: 'HomeScreen', title: 'Personalized For You', description: 'Get daily recommendations based on your mood and preferences.', position: 'bottom', order: 1 },
    { key: 'home-quick-access', screen: 'HomeScreen', title: 'Quick Access', description: 'Your most used tools, one tap away.', position: 'bottom', order: 2 },
    
    // Tools screen
    { key: 'tools-categories', screen: 'ToolsScreen', title: 'Explore Categories', description: 'Browse breathing, grounding, focus, and more.', position: 'bottom', order: 1 },
    { key: 'tools-filter', screen: 'ToolsScreen', title: 'Filter & Sort', description: 'Find exactly what you need with filters.', position: 'left', order: 2 },
    { key: 'tools-favorites', screen: 'ToolsScreen', title: 'Save Favorites', description: 'Long-press any exercise to add to favorites.', position: 'top', order: 3 },
    
    // Journal screen
    { key: 'journal-entry', screen: 'JournalScreen', title: 'Start Writing', description: 'Tap to create a new journal entry.', position: 'top', order: 1 },
    { key: 'journal-prompts', screen: 'JournalScreen', title: 'Need Inspiration?', description: 'Use prompts to guide your reflection.', position: 'bottom', order: 2 },
    
    // Breathing screen
    { key: 'breathing-tap', screen: 'BreathingScreen', title: 'Tap to Pause', description: 'Tap the circle anytime to pause and resume.', position: 'bottom', order: 1 },
    
    // Focus screen
    { key: 'focus-sounds', screen: 'FocusSessionScreen', title: 'Add Background Sounds', description: 'Mix ambient sounds for better focus.', position: 'top', order: 1 },
    
    // Story player
    { key: 'story-timer', screen: 'StoryPlayerScreen', title: 'Sleep Timer', description: 'Set a timer to stop playback automatically.', position: 'top', order: 1 },
    { key: 'story-scrub', screen: 'StoryPlayerScreen', title: 'Scrub Through', description: 'Drag to skip to any part of the story.', position: 'top', order: 2 },
    
    // Profile screen
    { key: 'profile-settings', screen: 'ProfileScreen', title: 'Customize Your Experience', description: 'Adjust sounds, haptics, and notifications.', position: 'left', order: 1 },
    { key: 'profile-stats', screen: 'ProfileScreen', title: 'Track Your Progress', description: 'See your streaks, sessions, and achievements.', position: 'bottom', order: 2 },
  ];

  for (const mark of coachMarks) {
    await prisma.coachMark.upsert({
      where: { key: mark.key },
      update: mark,
      create: mark,
    });
  }

  console.log(`✅ Created ${coachMarks.length} coach marks`);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
