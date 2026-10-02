# Project 3 — Roadmap

*Working plan, updated 2026-09-30 (afternoon). Placeholder name. Built on the shared engine in `f1gtrees/driftmoor-game-engine` (`games/project-3/`).*

## The game in one line
A mobile roguelike-RPG you can play for five minutes or four hours: built for parents who can't commit 30 minutes every time they sit down, but still fun with a whole evening. Auto-attacks and a few buttons, runs through portal worlds, permanent progress between runs, an endless final boss that chases a best score. Local save, no internet required, no microtransactions.

## Design pillars
1. **Mobile-native.** Phone held upright, thumb-drag to move, auto-attack, 1–2 ability buttons.
2. **Any session length.** Short trips still pay off (XP for permanent upgrades). "Dinner time" = walk back through a portal to the hub and keep what you collected.
3. **Commit to a run.** Runs don't save halfway. Going back in means fighting back to where you were, but earlier trips have made you stronger.
4. **Build choices matter.** Starting build + random upgrade picks = many builds, tested against the endless final boss.
5. **Fair and offline.** Local save. No microtransactions.

## Game structure (from the sketch)
- **Main hub / city (home).** Safe. Vendors sell base-stat upgrades for XP. Stash for saved items. Later: leaderboard terminal.
- **Three portals**, each: Stages 1–N → **Portal Guardian** → **upgrade choice**.
  - Portal 1: choose 1 of 2 from all 6 upgrades.
  - Portal 2: choose 1 of 2 from the remaining 4.
  - Portal 3: choose 1 of the final 2.
- **After all three portals: the final boss (Eden).** Endless waves until you die; your score is how far you got.
- **One hero, three builds** (the weapon/power-up defines the build, no extra hero art):
  - **Survive** (tank), **Damage**, **Area**; each has its own colour (the pack's heals/buffs colours) and its own starting special.
  - Six build power-ups (two per build) + a seventh "little bit of everything" all-rounder.
  - Stack your own build for a bonus, or go swiss-army.
  - Build math: 3 upgrades picked from 6 = 20 upgrade sets × 3 starting builds = 60 builds.
- **Progress:**
  - **XP** drops during runs → spent at hub vendors on permanent base stats.
  - **One-time stat boosts** drop during runs → use right away, or stash at home for a big push.
  - **Special attacks use ammo**; you choose what to bring on each run.
  - **Death** loses what you collected and what you brought. *(To workshop once combat is fun.)*

## Room rules (decided 2026-09-30)
- **A run** = from leaving the hub until you're back at the hub (or knocked out).
- **Placed enemies** (set in World Builder, optionally fenced in by zones to guard chests/loot) **stay dead for the rest of the run** once killed.
- **The swarm** (a room setting): waves of enemies appear just off-screen around the hero, a group every few seconds, each wave bigger and tougher. The **final wave brings a mini boss**; beating it **clears the room** and **opens its locked portal** onward.
- After clearing, the player chooses: explore (fight placed enemies for loot), go on to the next room, or head back.
- A cleared swarm stays cleared for the rest of the run.

## Specials, weapons and money (decided 2026-10-01)
**Specials fire on their own** (auto-attacks with a cooldown), Vampire-Survivors style. Two per build:
- **Coverage (area)**
  - *Boomerang axe*: thrown in a random direction; where it lands, area damage. Upgrades: more axes, bigger area.
  - *Ice spike*: spikes burst from the ground in a ring around the hero; everyone in the circle is hit, plus a freeze effect (likely extra damage over a few seconds). Upgrades: radius, damage.
- **Survivability**
  - *Poison bottle*: like the ice spike, with a smaller first hit; the poison drains enemies and heals the hero. Upgrades: radius, strength.
  - *Rune spell*: an **always-on aura** around the hero that hurts anything touching it; starts small or weak as the trade-off.
- **Scale damage**
  - *Chain lightning*: strikes the 3 closest enemies, plus 1 beyond them, with a % chance to chain to more. Upgrades: starting count, chain count.
  - *Fireball*: shoots the way the hero faces and hurts everything in its path up to a set distance. Upgrades: distance, damage, number of fireballs.

**Getting specials:** a run **starts with just the weapon**, with no specials. Beating a room's mini boss opens the portal and **two chests appear beside it**, each with a random special. Pick one; the other is gone. First time: 2 of the 6. Next mini boss: 2 of the 4 left. Then the final 2. (So a run collects up to three specials.)

**Weapons:** the player takes **sword OR gun** into a run. Both are **automatic**: the sword is the current auto-attack (to be honed: damage and radius upgrades); the gun shoots on its own, with no melee. Everything is auto, Vampire-Survivors style; the ACT button is kept spare for later.

**Money and XP (two separate things):**
- **Money:** enemies drop it (at a set rate and value); walk over it to pick it up; a running counter in the HUD. Spent at the wandering vendor.
- **XP:** earned from kills (how much depends on how many and which enemies). Kept and spent **at the hub** on sword or gun upgrades.
- **No more in-run levels:** the XP coins and the XP bar / level counter become **money coins and a money counter**. Power during a run comes from specials and the vendor.

**The wandering vendor:** in each room or run, a vendor appears somewhere random (shown on the mini map, once there is one). Walk to them and a menu offers a few random choices (a damage buff, +1 special projectile but less max health, ...). After a purchase, the vendor disappears, then turns up again some minutes later somewhere else with a new random selection.

## Order of work
Each step is tested on the phone before moving on.

### ✅ Done so far
- Big-image rooms at 3× scale, props you can walk behind, blocking
- World Builder picture-room editor: props from tilesets, enemies with their own numbers, zones, portals, hub flag, test walk
- First combat: auto-melee, ACT bolt, warrior enemy, waves, knock-out
- Portals between rooms, health carried between rooms, hub heals
- Purchased hero swapped in: three facings, spin slash as an area auto-attack, death animation, static backpack antenna
- XP coins → level-ups (more damage), levels reset at the hub
- Swarm rooms: waves around the hero, mini boss, locked portal opens when cleared; placed enemies stay dead for the run
- Three enemies: **Warrior** (sword), **Guard** (spear: slow, tough, long reach), **Archer** (keeps its distance, shoots arrows that props stop)
- World Builder **Tuning** screen: game zoom, hero numbers, each enemy type's base numbers
- World Builder **HUD editor**: one phone preview with a grid and centre snap; place, size, show/hide each control; the game fits it to any phone
- **Pause button + menu system** (menu.js): pause freezes the game; Inventory / Settings pages are placeholders for now
- Room editor: hold Space for Select / move
- **All six specials** (ice spike, fireball, boomerang axe, poison bottle, rune spell, chain lightning) with freeze/poison effects, testing switches, numbers in Tuning
- **Money wallet** (coins → HUD counter); in-run levels removed
- **Wandering vendor + shop** (shop.js, shop-data.js): appears in fight rooms, walk up to trade, random offers, leaves after a purchase and comes back later elsewhere; run upgrades (damage, health, speed, specials faster/bigger, any special's numbers)
- **Inventory page** (pause menu): wallet, health, specials, what you bought; menus use the pack's pixel frames
- World Builder **Shop** screen (vendor settings + item catalog + effects) and a per-room **Vendor** setting (random / always / never)
- Shop items: on/off switches, icons, debuffs (drawbacks), buff glows; new warrior / archer / guard art with three facings
- **Press and hold on** the vendor or a loot box to open it (fill-up bar; time and look set in World Builder)
- **Loot boxes** (room editor tool): items / specials / money, disappear / come back elsewhere / stay
- **Mini map** (HUD editor: size, range, opacity, enemies, round)
- **Text boxes** (World Builder → Text): scripts, placement on screen, events (vendor before/after, loot, boss, room cleared) and per-room arrival text
- Enemies **path around props** (nav.js) — choke points work
- World Builder **Open file…** (bring back exported files from Downloads)

### 1. ~~Hero swap~~ — done
The purchased hero: three facings (down / side / up), real attack animations instead of the white arc, death animation, possibly the roll as a dodge.

### 2. Combat honing — *in progress*
- The hero as data (stats, auto-attack, special slots), like the enemies
- One stats system: base stats + run upgrades + one-time boosts
- ~~First power-up as ACT ammo~~ → replaced by **specials** (auto-firing, see above). Next: the specials system + first two specials
- ~~Money drops + the wandering vendor~~ **built**
- Chests after the mini boss: pick 1 of 2 specials
- Sword-or-gun choice (the gun fires automatically)
- ~~XP drops~~ **built:** coins drop from enemies (boss drops several) → XP bar → level up = more damage; next level takes more XP; levels last for the run. All numbers in Tuning.
- ~~A second enemy type~~ **built:** Guard and Archer (enemies can now shoot)
- Enemy mix in swarms (right now a swarm is one enemy type)
- ~~Waves and pacing~~ **swarm built** (World Builder → Swarm): waves, group size, timing, per-wave toughness/speed, mini boss, locked portals. *Now: tune the numbers by playing.*

### 3. One full portal run
Stages 1–3 → Guardian → pick 1 of 2 upgrades → back to hub.
**Checkpoint: is one run fun in about five minutes?**

### 4. Save file and hub
Local save (XP, base upgrades, stash, portals beaten, best score). XP vendor. Choose your loadout (specials and ammo, one-time boosts) before a run.

### 5. Builds and upgrades
Three starting builds, six build power-ups plus the all-rounder, the upgrade-choice screen.

### 6. Final boss and scores
Endless waves, best score saved locally. Optional online leaderboard: a hub terminal that uploads your best score when there's internet (needs the game hosted publicly, e.g. GitHub Pages, plus a small free score service).

### 7. Content and polish
Three portal worlds' stages and guardians, more enemies, art pass, sound, balance.

## Open questions
- What exactly does dying cost? (Workshop after combat is fun.)
- What do the four heals/buffs colours do: build colours, rarity, or both?
- How many stages per portal, and how long should each take?
- Hero sheet: which walk row is walk and which is run; is rows 5/17 a roll or a jump?

## Assets on hand
- **STRANDED** (Penusbmic): world tileset, dome huts, props, warrior enemy, free hero (being replaced)
- **Main hero** (purchased): 64×65 frames, three facings, idle / walk / run / thrust / spin slash / roll, death; heals and buffs effects (four colours); gun sprites
- **Power-ups** (purchased): pink blade, green creature + cloud, rocket + storm explosion, lightning strikes, blue crystals, fire burst, fireball, spinning green blade, cyan zigzag (most with a pickup, a flying version and an impact)

See `PARKING_LOT.md` for smaller ideas saved for later.
