# Mini-3Dgame

A lightweight PUBG-inspired third-person 3D browser survival shooter prototype made with Three.js.

## Current features

- Third-person camera and mouse / touch aiming
- Desktop WASD movement plus mobile virtual joystick
- Rifle shooting, ammo, reload, hit marker and headshot bonus
- 100 HP player health
- 5 enemy bots with movement, strafing, obstacle avoidance and ranged attacks
- Spawn protection
- Buildings, walls, roads and trees with collision
- Shrinking safe zone with damage outside the circle
- HUD with HP, alive count, kills, ammo and zone radius
- Live minimap
- Pause and restart controls
- Responsive PC + mobile layout

## Run

This project is static. Open it from a local web server or publish the repository with GitHub Pages.

For example, from the project directory:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Controls

**Desktop**

- `W A S D` — move
- `Shift` — sprint
- Mouse — aim / rotate camera
- Left mouse — fire
- Right mouse — aim down sights
- `R` — reload
- `P` — pause

**Mobile**

- Left joystick — move
- Drag the right side — aim
- `FIRE` — shoot
- `RLD` — reload

## Next milestones

1. Better bot navigation with waypoint / nav-grid pathfinding
2. Loot pickups and weapon switching
3. Lobby and match settings
4. Friend multiplayer and 1v1 using a realtime backend
5. Larger map, sound, animation and polished VFX
