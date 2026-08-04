import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const apps = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/apps',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    thumbnail: z.string().optional(),
    github: z.string().optional(),
    demo: z.string().optional(),
    tags: z.array(z.string()).optional(),
    featured: z.boolean().optional(),
  }),
});

export const collections = {
  apps,
};
