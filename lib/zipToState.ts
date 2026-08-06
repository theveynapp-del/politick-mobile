// Compact ZIP-to-state resolver using contiguous 3-digit ZIP prefix ranges
// (standard USPS allocation — state ZIP ranges are contiguous blocks, so a
// small range table covers all 50 states + DC without a 900-row lookup or
// an extra network call).
const ZIP3_RANGES: [number, number, string][] = [
  [6, 9, "Puerto Rico"], [10, 27, "Massachusetts"], [28, 29, "Rhode Island"],
  [30, 38, "New Hampshire"], [39, 49, "Maine"], [50, 59, "Vermont"],
  [60, 69, "Connecticut"], [70, 89, "New Jersey"],
  [100, 149, "New York"], [150, 196, "Pennsylvania"], [197, 199, "Delaware"],
  [200, 205, "District of Columbia"], [206, 219, "Maryland"],
  [220, 246, "Virginia"], [247, 268, "West Virginia"], [270, 289, "North Carolina"],
  [290, 299, "South Carolina"], [300, 319, "Georgia"], [320, 349, "Florida"],
  [350, 369, "Alabama"], [370, 385, "Tennessee"], [386, 397, "Mississippi"],
  [398, 399, "Georgia"], [400, 427, "Kentucky"], [430, 459, "Ohio"],
  [460, 479, "Indiana"], [480, 499, "Michigan"], [500, 528, "Iowa"],
  [530, 549, "Wisconsin"], [550, 567, "Minnesota"], [570, 577, "South Dakota"],
  [580, 588, "North Dakota"], [590, 599, "Montana"], [600, 629, "Illinois"],
  [630, 658, "Missouri"], [660, 679, "Kansas"], [680, 693, "Nebraska"],
  [700, 714, "Louisiana"], [716, 729, "Arkansas"], [730, 749, "Oklahoma"],
  [750, 799, "Texas"], [800, 816, "Colorado"], [820, 831, "Wyoming"],
  [832, 838, "Idaho"], [840, 847, "Utah"], [850, 865, "Arizona"],
  [870, 884, "New Mexico"], [889, 898, "Nevada"], [900, 961, "California"],
  [967, 968, "Hawaii"], [970, 979, "Oregon"], [980, 994, "Washington"],
  [995, 999, "Alaska"],
];

export function stateForZip(zip: string): string | null {
  const prefix = parseInt(zip.slice(0, 3), 10);
  if (isNaN(prefix)) return null;
  const match = ZIP3_RANGES.find(([lo, hi]) => prefix >= lo && prefix <= hi);
  return match ? match[2] : null;
}
