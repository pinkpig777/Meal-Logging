import { createCn } from 'cn/config';

/**
 * Join and merge Tailwind classes (shadcn/ui convention).
 * Extended with our custom theme keys (src/index.css) so e.g. `text-caption`
 * (font size) is not mistaken for a text color and dropped next to
 * `text-muted-foreground`.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'title', 'heading', 'body', 'label', 'caption'] }],
      rounded: [{ rounded: ['card', 'control', 'small'] }],
      shadow: [{ shadow: ['card'] }],
    },
  },
});
