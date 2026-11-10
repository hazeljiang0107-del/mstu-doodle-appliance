# Coffee Machine State Model

An interactive model of a single-serve drip coffee maker, built with HTML, CSS, and JavaScript for the MSTU Appliance Doodle. The focus is on the logic: what state the machine is in, and what makes it change.

**Run it:** open `index.html` in a browser. No install needed.

## States

The variable `machineState` is always one of these:

| State | What it means |
| --- | --- |
| `off` | No power. Water slowly cools back to room temperature. |
| `heating` | Powered on, water warming toward 92°C. |
| `ready` | Hot and waiting for a brew. Auto-off countdown is running. |
| `brewing` | Coffee is pouring into the cup. |
| `paused` | The cup was pulled out mid-brew (drip-stop). |
| `done` | Cup is full and waiting to be taken. |

Other variables describe the rest of the machine: `temperature`, `waterLevel`, `beansLevel`, `cupPresent`, `cupContents`, `brewSize`, `strength`, `brewProgress`, and `idleSeconds`.

## Transitions

Some transitions come from the user, others from time passing:

- **Power** pressed while `off` → `heating`, or straight to `ready` if the water is still hot. Pressed while on → `off` (cancels a brew in progress).
- `heating` → `ready` once `temperature` reaches 92°C.
- **Brew** pressed while `ready` → `brewing`, but only if there is a cup, it's empty, and there's enough water and beans.
- **Remove cup** while `brewing` → `paused`. **Place cup** while `paused` → `brewing`.
- `brewing` → `done` when `brewProgress` hits 100%.
- **Remove cup** while `done` → `ready`.
- `ready` or `done` → `off` after 45 seconds with no activity.

Every transition goes through `setState(next, reason)`, which also writes it to the on-page State log.

## How control flow is used

`pressBrew()` is an `if / else if` chain: it checks the reasons a brew can't start, in order (off, heating, already brewing, no cup, full cup, low water, low beans). The first one that matches decides the message, and only if none match does brewing start. The order matters: telling someone "not enough water" while the machine is still off would be confusing.

`tick()` runs every 100 ms and uses `if / else if` on `machineState` to decide what time does in each state: cool down, heat up, count toward auto-off, or pour coffee. Stronger brews drip slower (`brewSeconds = 4 + strength`).

`render()` uses conditions to turn state into visuals: which lights glow, whether the coffee stream is flowing, how full the cup and gauges are, and whether the size and strength controls are locked during a brew.

## Events (a head start)

An *event* is something that happens on the page, like a click, a slider moving, or a dropdown changing. `addEventListener` tells the browser: "when this event happens on this element, run this function."

```js
brewBtn.addEventListener("click", () => { pressBrew(); render(); });
```

The code never calls `pressBrew()` directly; the browser calls it whenever the user clicks. So the program is a set of reactions that sit and wait. Each reaction has the same shape: an event comes in, the state variables change (with `if` statements deciding how), and `render()` updates the screen to match.

`setInterval(..., 100)` works the same way, except the "event" is time passing instead of a user action. That's how the machine can heat up or turn itself off while you aren't touching it.
