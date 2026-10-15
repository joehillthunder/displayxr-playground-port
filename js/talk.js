// Conversations. Characters talk to each other in short scripted exchanges that fit what they are
// doing: two kids meeting up, kids side by side on the swings or in the ball pit, Mom calling out to
// a kid, the ice-cream seller taking an order, a kid saying hi to Biscuit, or you walking up to a
// kid for a chat. Each line shows as a speech bubble at the speaker's depth, the speaker's mouth
// moves and they babble in their own voice, and listeners turn their heads to whoever is talking.
//
// Script lines are [who, text]: who is the index of the participant (0 = the one who starts it).
// {0} {1} {2} are replaced with the participants' names. A script can end with { then: activity },
// a plan the NPC kids in it carry out together afterwards.

import { pick } from './util.js';

export const SCRIPTS = {
  meet: [
    [[0, 'Hi {1}!'], [1, 'Hi {0}! Wanna play?'], [0, "Yeah! Let's go on the swings!"], [1, 'Race you!'], { then: 'swing' }],
    [[0, '{1}! Did you see me on the spiral slide?'], [1, 'No! Was it fast?'], [0, 'Super fast! I flew off the end!'], [1, 'I wanna try!'], { then: 'wallClimb' }],
    [[0, 'I found a ladybug!'], [1, 'Where?'], [0, 'On my hand! Oh... it flew away.'], [1, 'Bye, ladybug!']],
    [[0, 'My dog can do a backflip.'], [1, 'No way!'], [0, 'Okay... almost a backflip.'], [1, 'Ha ha ha!']],
    [[0, 'Wanna jump in the ball pit?'], [1, 'Cannonball!!'], [0, 'Last one in is a rotten egg!'], { then: 'ballPit' }],
    [[0, 'Look, an ice cream cart!'], [1, 'I want strawberry!'], [0, 'I want chocolate!'], [1, "Let's go ask!"], { then: 'icecream' }],
    [[0, 'Do you like dinosaurs?'], [1, 'I LOVE dinosaurs!'], [0, 'Rawr!'], [1, 'RAWRRR!']],
    [[0, "I'm building the biggest sandcastle ever."], [1, 'Can I help?'], [0, 'You can be in charge of the moat!'], [1, 'Yesss!'], { then: 'sandbox' }],
    [[0, 'How old are you?'], [1, 'Six and three quarters.'], [0, "I'm almost seven!"], [1, 'Whoa.']],
    [[0, 'Is it lunch time yet?'], [1, 'I hope it’s pizza.'], [0, 'Pizza with ice cream on top!'], [1, 'Ewww! ...Actually, yum.']],
    [[0, "Let's climb to the very top!"], [1, "I'm not scared!"], [0, 'Me neither! Come on!'], { then: 'ladderSlide' }],
    [[0, 'Wanna spin on the merry-go-round?'], [1, 'Until we get dizzy!'], [0, 'Dizzy race!'], { then: 'merry' }],
    [[0, 'Guess what?'], [1, 'What?'], [0, 'Chicken butt!'], [1, 'Hee hee hee!']],
    [[0, 'I lost my tooth yesterday!'], [1, 'Did the tooth fairy come?'], [0, 'She gave me a shiny coin!'], [1, 'Lucky!']],
  ],
  pit: [
    [[0, 'There are a million balls in here!'], [1, 'A billion!']],
    [[0, 'The red ones are the best!'], [1, 'No way, blue is the best!']],
    [[0, "I'm a shark! Chomp chomp!"], [1, 'Aaah! Shark attack!']],
    [[0, 'I can swim in the balls!'], [1, 'Me too! Look!']],
    [[0, 'I lost my shoe in here!'], [1, 'I see it! ...No, that’s a ball.']],
  ],
  swing: [
    [[0, "I'm going higher than you!"], [1, 'No, I am!']],
    [[0, 'I can touch the clouds!'], [1, 'Me too!']],
    [[0, "Let's jump off at the same time!"], [1, 'One, two... THREE!']],
    [[0, 'My tummy feels tickly!'], [1, 'Mine too! Wheee!']],
  ],
  seesaw: [
    [[0, 'Up you go!'], [1, 'Wheee! Down you go!']],
    [[0, "We're like a rocket!"], [1, 'Three, two, one, blast off!']],
    [[0, "You're heavy!"], [1, "No, YOU'RE heavy!"]],
  ],
  merry: [
    [[0, 'Faster! Faster!'], [1, "I'm so dizzy!"]],
    [[0, 'The sky is spinning!'], [1, 'Whoaaa!']],
  ],
  tower: [
    [[0, "I'm the king of the castle!"], [1, "And I'm the queen of the castle!"]],
    [[0, 'I can see my house from here!'], [1, 'Really? Where?']],
    [[0, 'Ahoy! Pirate ship!'], [1, 'Arrr! Walk the plank!']],
  ],
  sandbox: [
    [[0, 'Pass me the bucket!'], [1, 'Here you go!']],
    [[0, 'This is a volcano!'], [1, 'Kaboom!']],
    [[0, "Let's dig to the other side of the world!"], [1, 'Hello, China!']],
  ],
  mom: [
    [[0, '{1}, sunscreen!'], [1, 'Aww, Mom!']],
    [[0, 'Five more minutes, {1}!'], [1, 'Ten more minutes?']],
    [[0, 'Careful on the slide, {1}!'], [1, "I'm always careful!"]],
    [[0, 'Drink some water, {1}!'], [1, 'Okaaay!']],
    [[0, 'I see you up there, {1}!'], [1, 'Look at me, Mom!']],
  ],
  grandpa: [
    [[0, 'In my day, slides were made of metal!'], [1, 'Whoa, really?'], [0, 'And they were hot as toast!']],
    [[0, 'Want to help feed the pigeons, {1}?'], [1, 'Yes please!']],
    [[0, "That's a fine-looking sandcastle!"], [1, 'Thanks, Grandpa!']],
  ],
  dad: [
    [[0, 'Want to throw the ball for Biscuit, {1}?'], [1, 'Yes! Fetch, Biscuit!']],
    [[0, 'Nice jump, {1}!'], [1, 'Thanks!']],
  ],
  icecream: [
    [[0, 'Hello there! What flavor?'], [1, 'Strawberry, please!'], [0, 'Here you go!'], [1, 'Thank you!']],
    [[0, 'One scoop or two?'], [1, 'Two! No, three!'], [0, 'Two it is. Enjoy!'], [1, 'Yummy!']],
    [[0, 'Hi {1}! The usual?'], [1, 'Chocolate with sprinkles!'], [0, 'Coming right up!']],
  ],
  dog: [
    [[0, 'Hi Biscuit!'], [1, 'Woof!']],
    [[0, "Who's a good boy?"], [1, 'Arf arf!'], [0, 'You are!']],
    [[0, 'Biscuit, sit!'], [1, '...Woof?']],
  ],
  // An NPC kid chatting with you (you are participant 1; your kid answers on their own).
  player: [
    [[0, 'Hi! I’m {0}. Wanna be friends?'], [1, "Sure! I'm {1}!"], [0, 'Yay! Race you to the slide!'], { then: 'ladderSlide' }],
    [[0, "Hey {1}! Have you done the cannonball yet?"], [1, 'Not yet!'], [0, 'Jump off the diving board! It’s SO fun!']],
    [[0, 'Did you know Biscuit loves fetch?'], [1, 'Really?'], [0, 'Ask his dad! He’s by the big tree.']],
    [[0, 'Push me on the swing?'], [1, 'Okay!'], [0, 'Higher! Higher!'], { then: 'swing' }],
    [[0, 'Tag! You’re it!'], [1, 'Hey!'], [0, 'Bet you can’t catch me!'], { then: 'tag' }],
    [[0, "I'm gonna get an ice cream."], [1, "What's your favorite flavor?"], [0, 'Rainbow!'], { then: 'icecream' }],
    [[0, 'The merry-go-round goes SO fast if you push it a lot.'], [1, 'Let’s try it!']],
  ],
};

export class Conversations {
  /** @param {{ say(ch, text, dur, name): void }} bubbles  @param sfx  @param getPlayer */
  constructor(world, bubbles, sfx, getPlayer) {
    this.world = world;
    this.bubbles = bubbles;
    this.sfx = sfx;
    this.getPlayer = getPlayer;
    this.active = [];
  }

  busy(ch) {
    return !!ch.convo;
  }

  /**
   * Start a conversation. parts: characters (or the dog). opts.hold: participants stop to talk
   * (NPC brains pause and they face each other). Returns the conversation, or null.
   */
  start(kind, parts, opts = {}) {
    if (parts.some((p) => !p || p.convo)) return null;
    const script = opts.script || pick(SCRIPTS[kind]);
    const lines = script.filter(Array.isArray);
    const meta = script.find((x) => !Array.isArray(x)) || {};
    const c = { kind, parts, lines, i: 0, t: opts.delay ?? 0, hold: !!opts.hold, then: meta.then, onEnd: opts.onEnd };
    for (const p of parts) p.convo = c;
    this.active.push(c);
    return c;
  }

  end(c) {
    for (const p of c.parts) {
      if (p.convo === c) p.convo = null;
      p.lookTarget = null;
    }
    this.active.splice(this.active.indexOf(c), 1);
    c.onEnd?.(c);
  }

  update(dt) {
    for (const c of [...this.active]) {
      c.t -= dt;
      if (c.hold) {
        // Face each other while talking (only on foot).
        for (const p of c.parts) {
          if (p.mode !== 'ground' || !p.input) continue;
          const o = c.parts.find((x) => x !== p);
          const want = Math.atan2(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
          let d = want - p.yaw;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          p.yaw += d * Math.min(1, dt * 6);
        }
      }
      if (c.t > 0) continue;
      if (c.i >= c.lines.length) { this.end(c); continue; }
      const [who, raw] = c.lines[c.i++];
      const speaker = c.parts[who];
      const text = raw.replace(/\{(\d)\}/g, (_, n) => c.parts[+n]?.name ?? '');
      const dur = Math.min(4.2, 1.2 + text.length * 0.055);
      this.bubbles.say(speaker, text, dur + 0.4, speaker.name);
      speaker.talkT = dur * 0.8;
      for (const p of c.parts) p.lookTarget = p === speaker ? c.parts.find((x) => x !== p) : speaker;
      const pl = this.getPlayer();
      if (speaker.isDog) this.near(speaker, pl, 14) && this.sfx.bark();
      else if (this.near(speaker, pl, 12)) this.sfx.voice(text, speaker.voice, speaker.adult);
      c.t = dur + 0.25;
    }
  }

  near(a, pl, r) {
    return pl && Math.hypot(a.pos.x - pl.pos.x, a.pos.z - pl.pos.z) < r;
  }
}
