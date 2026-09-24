import type { PoseId } from "./catalog";

/** The script the app opens with: one line (one emotional beat) for each pose. */
export const SAMPLE_LINES: { text: string; pose: PoseId }[] = [
  { pose: "happy", text: "Hi there! I'm Clawd, and I'm so glad you're here." },
  { pose: "surprised", text: "Wait, what?! I'm totally shocked. Did you just delete the database?" },
  { pose: "sad", text: "Oh no. I'm so sorry, that's really disappointing news." },
  { pose: "angry", text: "Ugh, why does this build keep failing? This is so frustrating!" },
  { pose: "thinking", text: "Hmm, let me think about how we could fix this." },
  { pose: "confused", text: "I'm puzzled. I don't understand what this error even means." },
  { pose: "excited", text: "We did it! All the tests pass! I'm so thrilled, let's celebrate!" },
  { pose: "love", text: "Honestly, I love working on this project with you." },
  { pose: "scared", text: "Is something moving in the dark? I'm getting scared." },
  { pose: "neutral", text: "Okay. The next meeting starts at three o'clock." },
];

export const SAMPLE_SCRIPT = SAMPLE_LINES.map((line) => line.text).join("\n");

/**
 * Labeled lines for `bun run eval`: three per pose, mostly WITHOUT the words in the pose
 * descriptions, so they test understanding rather than keyword matching.
 */
export const LABELED_LINES: { text: string; pose: PoseId }[] = [
  { pose: "neutral", text: "The report is due on Friday afternoon." },
  { pose: "neutral", text: "Please pass me the stapler." },
  { pose: "neutral", text: "The train leaves from platform four." },
  { pose: "happy", text: "What a lovely morning, the sun is shining!" },
  { pose: "happy", text: "The drawing turned out nicely, I'm pleased with it." },
  { pose: "happy", text: "That was a nice little walk, I feel good." },
  { pose: "excited", text: "We won the championship! I can't believe it, let's party!" },
  { pose: "excited", text: "Tomorrow we leave for Japan and I can hardly wait!" },
  { pose: "excited", text: "Yes! The launch was a massive success!" },
  { pose: "love", text: "I adore you more than words can say." },
  { pose: "love", text: "Thank you for always being there for me, you mean the world to me." },
  { pose: "love", text: "My little cat is the sweetest thing, I just want to hug her." },
  { pose: "sad", text: "My best friend moved away and I miss her so much." },
  { pose: "sad", text: "I failed the exam again. I feel so down." },
  { pose: "sad", text: "Nobody came to my birthday party." },
  { pose: "angry", text: "Stop interrupting me! I've had enough of this!" },
  { pose: "angry", text: "You broke my laptop and didn't even apologize?" },
  { pose: "angry", text: "This is the third time they've cancelled on me. I'm furious." },
  { pose: "surprised", text: "Whoa, I didn't expect to see you here!" },
  { pose: "surprised", text: "No way, you're getting married?!" },
  { pose: "surprised", text: "Wait, the package already arrived? That was fast!" },
  { pose: "scared", text: "Did you hear that noise downstairs? Someone's in the house." },
  { pose: "scared", text: "I'm terrified of what the doctor will say tomorrow." },
  { pose: "scared", text: "Please don't turn off the lights, I don't like the dark." },
  { pose: "confused", text: "Which way are we supposed to go? None of these signs make sense." },
  { pose: "confused", text: "I've read this paragraph three times and still have no idea what it means." },
  { pose: "confused", text: "Why would the function return null here? That doesn't add up." },
  { pose: "thinking", text: "Let me consider the options before we decide." },
  { pose: "thinking", text: "Maybe if we move the table over there, it would fit." },
  { pose: "thinking", text: "I wonder what would happen if we tried it the other way around." },
];
