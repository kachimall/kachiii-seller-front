import { createCn } from "cn/config";

// Teach class merging about the design's custom type scale, so `text-label-xs`
// is treated as a font size and isn't dropped when combined with `text-white`.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "headline-xl",
            "headline-xl-mobile",
            "headline-lg",
            "headline-lg-mobile",
            "headline-md",
            "headline-sm",
            "body-lg",
            "body-md",
            "body-sm",
            "price-hero",
            "price-card",
            "label-md",
            "label-xs",
          ],
        },
      ],
    },
  },
});
