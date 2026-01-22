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

  // Seed breathing exercises
  const breathingExercises = [
    {
      slug: 'box-breathing',
      name: 'Box Breathing',
      description: 'A calming technique used by Navy SEALs to manage stress',
      type: ContentType.BREATHING,
      category: 'stress-relief',
      duration: '240',
      isPremium: false,
      status: ContentStatus.PUBLISHED,
      data: {
        inhale: 4,
        hold: 4,
        exhale: 4,
        holdAfterExhale: 4,
        rounds: 4,
      },
      icon: '📦',
      bestFor: 'Stress relief, Focus, Anxiety',
      tags: ['beginner', 'popular'],
      order: 1,
    },
    {
      slug: '478-breathing',
      name: '4-7-8 Breathing',
      description: 'Dr. Weil\'s technique for falling asleep in 60 seconds',
      type: ContentType.BREATHING,
      category: 'sleep',
      duration: '180',
      isPremium: false,
      status: ContentStatus.PUBLISHED,
      data: {
        inhale: 4,
        hold: 7,
        exhale: 8,
        rounds: 3,
      },
      icon: '😴',
      bestFor: 'Sleep, Relaxation, Anxiety',
      tags: ['sleep', 'popular'],
      order: 2,
    },
  ];

  for (const exercise of breathingExercises) {
    await prisma.contentItem.upsert({
      where: { slug: exercise.slug },
      update: exercise,
      create: exercise,
    });
  }

  console.log('✅ Created breathing exercises');

  // Seed grounding techniques
  const groundingTechniques = [
    {
      slug: '54321-grounding',
      name: '5-4-3-2-1 Grounding',
      description: 'A sensory awareness technique to bring you back to the present',
      type: ContentType.GROUNDING,
      category: 'anxiety',
      duration: '300',
      isPremium: false,
      status: ContentStatus.PUBLISHED,
      data: {
        steps: [
          'Name 5 things you can see',
          'Name 4 things you can touch',
          'Name 3 things you can hear',
          'Name 2 things you can smell',
          'Name 1 thing you can taste',
        ],
      },
      icon: '👁️',
      bestFor: 'Anxiety, Panic, Grounding',
      tags: ['beginner', 'popular'],
      order: 1,
    },
  ];

  for (const technique of groundingTechniques) {
    await prisma.contentItem.upsert({
      where: { slug: technique.slug },
      update: technique,
      create: technique,
    });
  }

  console.log('✅ Created grounding techniques');

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
