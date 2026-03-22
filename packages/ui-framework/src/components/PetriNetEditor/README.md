# Petri Net Editor Component

A visual, interactive editor for creating and simulating Petri nets (place/transition networks) in Tupan.

## Features

- **Visual Design**: Create places (circles) and transitions (rectangles)
- **Weighted Arcs**: Draw arcs between places and transitions with weight specification
- **Inhibitor Arcs**: Create inhibitor arcs that block transitions
- **Token Visualization**: See tokens as dots in places, with count display
- **Transition Firing**: Click transitions to fire in simulation mode
- **Petri Net Analysis**: View boundedness, safeness, liveness, and conservativeness
- **Simulation Support**: Real-time marking changes and deadlock detection
- **Property Editing**: Configure place tokens, arc weights, and transition names
- **Analysis Panel**: View current marking, enabled transitions, and analysis results

## Basic Usage

```tsx
import { PetriNetEditor } from '@tupan/ui-framework';

export function MyPetriNetApp() {
  const [data, setData] = React.useState({
    name: 'My Petri Net',
    places: [],
    transitions: [],
    arcs: [],
  });

  const [simState, setSimState] = React.useState({
    time: 0,
    marking: {},
    enabledTransitions: [],
    firedTransitions: [],
    isDeadlock: false,
  });

  return (
    <PetriNetEditor
      initialData={data}
      onDataChange={setData}
      onSimulationStateChange={setSimState}
      simulationMode={false}
    />
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `initialData` | `PetriNetEditorData` | Initial Petri net configuration |
| `onDataChange` | `(data: PetriNetEditorData) => void` | Called when structure changes |
| `onSimulationStateChange` | `(state: SimulationState) => void` | Called when simulation state updates |
| `readOnly` | `boolean` | Disable editing (default: false) |
| `simulationMode` | `boolean` | Enable simulation mode (default: false) |
| `analysisResults` | `AnalysisResult` | Display Petri net analysis results |

## Data Structure

```typescript
interface PetriNetEditorData {
  name: string;
  places: PlaceNodeData[];
  transitions: TransitionNodeData[];
  arcs: ArcData[];
  currentMarking?: Record<string, number>;
}

interface PlaceNodeData {
  id: string;
  name: string;
  x: number;
  y: number;
  tokens: number;
  capacity?: number;  // Max tokens (infinite if undefined)
  width: number;
  height: number;
}

interface TransitionNodeData {
  id: string;
  name: string;
  x: number;
  y: number;
  isEnabled: boolean;
  width: number;
  height: number;
}

interface ArcData {
  id: string;
  from: string;      // place or transition id
  to: string;        // transition or place id
  weight: number;    // tokens consumed/produced
  type: 'normal' | 'inhibitor';
  controlPoint?: { x: number; y: number };
}

interface SimulationState {
  time: number;
  marking: Record<string, number>;
  enabledTransitions: string[];
  firedTransitions: Array<{ id: string; time: number }>;
  isDeadlock: boolean;
}

interface AnalysisResult {
  boundedness: 'bounded' | 'unbounded';
  safeness: boolean;
  livenessLevel: 'dead' | 'deadlock-free' | 'live';
  conservativeness: boolean;
  reachabilityGraph?: {
    states: string[];
    edges: Array<{ from: string; to: string; transition: string }>;
  };
}
```

## Controls

### Canvas Interaction

| Action | Effect |
|--------|--------|
| **Click empty space** | Create new place at position |
| **Shift + Click empty space** | Create new transition at position |
| **Click place/transition** | Select for property editing |
| **Alt + Click place/transition** | Start drawing arc |
| **Alt + Click & drag** | Draw arc line to target |
| **Alt + Release over target** | Create arc between nodes |
| **Right-click place/transition** | Delete place or transition |
| **Scroll wheel** | Zoom in/out |

### Simulation Mode

| Action | Effect |
|--------|--------|
| **Click enabled transition** | Fire transition, update marking |
| **(property panel disabled)** | Cannot edit structure during simulation |

### Toolbar

- **🔍+**: Zoom in
- **🔍−**: Zoom out
- **▶ Sim**: Toggle simulation mode
- **⚙**: Toggle property panel
- **📊**: Toggle analysis panel
- **ℹ Help**: Show keyboard shortcuts

## Visual Elements

### Places
- **Circle**: Represents a place (state/resource holder)
- **Dots**: Token representation (1-5 tokens shown as dots, 5+ shows count)
- **Name**: Above the circle
- **Capacity**: Below the circle (if defined)

### Transitions
- **Rectangle**: Represents a transition (event)
- **Green fill**: Enabled (all input places have sufficient tokens)
- **White fill**: Disabled
- **Name**: Below the rectangle
- **Yellow animation**: Firing animation

### Arcs
- **Normal arc**: Solid line with arrowhead
- **Inhibitor arc**: Dashed line with circle ending
- **Weight label**: Middle of arc (if weight > 1)

## Simulation Algorithm

### Transition Enabling

A transition is **enabled** when:
1. All input places have ≥ arc weight tokens (normal arcs)
2. All inhibitor input places have 0 tokens

### Transition Firing

When a transition fires:
1. Consume `weight` tokens from each input place
2. Produce `weight` tokens in each output place
3. Update marking
4. Animate firing
5. Detect deadlock (no transitions enabled)

### Deadlock Detection

A **deadlock** occurs when:
- No transitions are enabled
- Simulation cannot progress further

## Analysis Features

### Boundedness
- **Bounded**: All places have finite upper token count
- **Unbounded**: At least one place can accumulate infinite tokens

### Safeness
- **Safe**: All places have capacity ≤ 1
- **Unsafe**: At least one place can have > 1 token

### Liveness Levels
- **Dead**: No transitions can fire from initial marking
- **Deadlock-Free**: Deadlock is impossible (paths always exist)
- **Live**: Every transition can eventually fire

### Conservativeness
- **Conservative**: Total tokens remain constant (no creation/destruction)
- **Non-conservative**: Tokens can be created or destroyed

### Reachability Graph
- **States**: Possible markings reachable from initial
- **Edges**: Transitions between markings
- **Size**: Complexity of Petri net behavior

## Example: Producer-Consumer Petri Net

```tsx
const producerConsumerExample: PetriNetEditorData = {
  name: 'Producer-Consumer',
  places: [
    {
      id: 'p_ready',
      name: 'Ready',
      x: 100,
      y: 150,
      tokens: 1,
      width: 60,
      height: 60,
    },
    {
      id: 'p_buffer',
      name: 'Buffer',
      x: 300,
      y: 150,
      tokens: 0,
      capacity: 3,
      width: 60,
      height: 60,
    },
    {
      id: 'p_consuming',
      name: 'Consuming',
      x: 500,
      y: 150,
      tokens: 0,
      width: 60,
      height: 60,
    },
  ],
  transitions: [
    {
      id: 't_produce',
      name: 'Produce',
      x: 200,
      y: 150,
      isEnabled: false,
      width: 15,
      height: 60,
    },
    {
      id: 't_consume',
      name: 'Consume',
      x: 400,
      y: 150,
      isEnabled: false,
      width: 15,
      height: 60,
    },
  ],
  arcs: [
    {
      id: 'a1',
      from: 'p_ready',
      to: 't_produce',
      weight: 1,
      type: 'normal',
    },
    {
      id: 'a2',
      from: 't_produce',
      to: 'p_buffer',
      weight: 1,
      type: 'normal',
    },
    {
      id: 'a3',
      from: 'p_buffer',
      to: 't_consume',
      weight: 1,
      type: 'normal',
    },
    {
      id: 'a4',
      from: 't_consume',
      to: 'p_consuming',
      weight: 1,
      type: 'normal',
    },
  ],
};
```

## Advanced Features

### Token Marking

Initial marking specifies starting token distribution. Can be modified in property panel during editing or automatically updated during simulation.

### Capacity Constraints

Places can have maximum token capacity. Transition firing is blocked if it would exceed capacity of output places.

### Weighted Arcs

Different arc weights enable modeling of batching:
- Weight 1: Single token transfer
- Weight 2+: Batch processing
- Fractional weights: Rare but possible

### Inhibitor Arcs

Block transitions based on absence:
- Used for mutual exclusion
- Implement priority
- Model safety constraints

## Performance

- Canvas-based rendering for efficient visualization (100+ places/transitions)
- Lazy rendering: only visible elements drawn
- Token counting optimization for large markings
- Animation frame-rate capped at 60 FPS

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Android Chrome)

## Accessibility

- Keyboard shortcuts for common operations
- Screen reader support (ARIA labels)
- High contrast mode support
- Zoom levels from 50% to 300%

## Known Limitations

- Max ~150 places/transitions per net (for UI responsiveness)
- Self-loops not supported (use dummy transition instead)
- Curved arcs simplified to straight lines
- No hierarchical/colored Petri nets yet

## Future Enhancements

- [ ] Hierarchical Petri nets (subnets)
- [ ] Colored/timed Petri nets
- [ ] Stochastic Petri nets (firing probabilities)
- [ ] PN analysis plugin (INA, Marcie integration)
- [ ] PNML export/import
- [ ] Animation playback
- [ ] Undo/redo history
- [ ] Multi-select and bulk operations
- [ ] Custom node styling
- [ ] Export to images/SVG

## Contributing

Contributions welcome! Please follow:
- Component structure in `PetriNetEditor.tsx`
- Test coverage in `__tests__/`
- TypeScript strict mode
- ESLint configuration

## References

- [Petri Nets Wikipedia](https://en.wikipedia.org/wiki/Petri_net)
- [Petri Net Markup Language (PNML)](https://www.pnml.org/)
- [ISO/IEC 15909 - High-level Petri Nets](https://www.iso.org/standard/52088.html)

## License

Same as Tupan project
