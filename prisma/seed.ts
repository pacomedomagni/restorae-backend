import { PrismaClient, ContentType, ContentStatus, SubscriptionTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

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
      passwordHash: '$2b$10$YourHashedPasswordHere', // You should hash this properly
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
