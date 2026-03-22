# State Machine Editor Component

A visual, interactive editor for creating and simulating finite state machines (FSMs) in Tupan.

## Features

- **Visual State Design**: Click to create states, drag to reposition
- **Transition Drawing**: Alt+Click → drag → release to create transitions
- **Property Editing**: Configure state/transition properties in the right panel
- **Initial/Final State Marking**: Mark which states are initial or final
- **Entry/Exit Actions**: Define actions when entering/leaving states
- **Guard Conditions**: Add conditions to transitions
- **Live Simulation**: Highlight active state during simulation
- **Zoom & Pan**: Navigate large state machines efficiently

## Basic Usage

```tsx
import { StateMachineEditor } from '@tupan/ui-framework';

export function MyStateMachineApp() {
  const [data, setData] = React.useState({
    name: 'My FSM',
    states: [],
    transitions: [],
  });

  return (
    <StateMachineEditor
      initialData={data}
      onDataChange={setData}
    />
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `initialData` | `StateMachineEditorData` | Initial state machine configuration |
| `onDataChange` | `(data: StateMachineEditorData) => void` | Called when data changes |
| `readOnly` | `boolean` | Disable editing (default: false) |
| `simulationMode` | `boolean` | Show simulation visualization (default: false) |
| `activeStateId` | `string` | Highlight active state during simulation |

## Data Structure

```typescript
interface StateMachineEditorData {
  name: string;
  states: StateNodeData[];
  transitions: TransitionData[];
  initialStateId?: string;
}

interface StateNodeData {
  id: string;
  name: string;
  x: number;
  y: number;
  isInitial: boolean;
  isFinal: boolean;
  entryAction?: string;
  exitAction?: string;
  width: number;
  height: number;
}

interface TransitionData {
  id: string;
  from: string;
  to: string;
  event: string;
  guard?: string;
  action?: string;
  controlPoint?: { x: number; y: number };
}
```

## Controls

### Canvas Interaction

| Action | Effect |
|--------|--------|
| **Click empty space** | Create new state at position |
| **Click state** | Select state for property editing |
| **Alt + Click state** | Start drawing transition |
| **Alt + Click & drag** | Draw transition line to target |
| **Alt + Release over state** | Create transition to target |
| **Right-click state** | Delete state |
| **Scroll wheel** | Zoom in/out |
| **Middle mouse button** | Pan around canvas |

### Toolbar

- **🔍+**: Zoom in
- **🔍−**: Zoom out
- **⚙**: Toggle property panel
- **ℹ Help**: Show keyboard shortcuts

## Backend Integration

### Converting to Backend StateMachine

```typescript
import { StateMachineEditor, StateMachineEditorData } from '@tupan/ui-framework';
import { StateId, State, Transition, Event } from '@tupan/core';

function convertToBackend(data: StateMachineEditorData) {
  // Create state machine
  const states = new Map<number, State>();
  const idMap = new Map<string, StateId>();

  // Add states
  let stateIndex = 0;
  for (const stateData of data.states) {
    const stateId = StateId.new(stateIndex);
    idMap.set(stateData.id, stateId);

    const state = new State(stateIndex, stateData.name);
    if (stateData.isInitial) state.isInitial = true;
    if (stateData.isFinal) state.isFinal = true;
    if (stateData.entryAction) state.entryAction = stateData.entryAction;
    if (stateData.exitAction) state.exitAction = stateData.exitAction;

    states.set(stateIndex, state);
    stateIndex++;
  }

  // Add transitions
  const transitions: Transition[] = [];
  for (const trans of data.transitions) {
    const fromId = idMap.get(trans.from)!;
    const toId = idMap.get(trans.to)!;

    transitions.push(
      new Transition(fromId, toId, trans.event)
        .withGuard(trans.guard)
        .withAction(trans.action)
    );
  }

  // Create state machine
  const initialStateId = data.initialStateId
    ? idMap.get(data.initialStateId)!
    : StateId.new(0);

  const machine = new StateMachine(data.name, initialStateId);
  states.forEach(state => machine.addState(state));
  transitions.forEach(trans => machine.addTransition(trans));

  return machine;
}
```

### Running Simulation

```typescript
import { StateMachineSimulator } from '@tupan/core';

function simulateStateMachine(
  editorData: StateMachineEditorData,
  events: Event[],
  onActiveStateChange: (stateId: string) => void
) {
  const backend = convertToBackend(editorData);
  const simulator = new StateMachineSimulator();

  // Queue events
  events.forEach(e => backend.enqueueEvent(e));

  // Run simulation with updates
  let time = 0;
  const dt = 0.01;
  const maxTime = 10.0;

  while (time < maxTime) {
    // Update active state visualization
    const currentStateName = backend.getState(backend.currentState)?.name;
    const currentStateId = editorData.states.find(
      s => s.name === currentStateName
    )?.id;

    if (currentStateId) {
      onActiveStateChange(currentStateId);
    }

    const result = simulator.step(backend, dt);
    if (result.isDone) break;

    time += dt;
  }
}
```

## Example: Traffic Light State Machine

```tsx
import React, { useState } from 'react';
import { StateMachineEditor, StateMachineEditorData } from '@tupan/ui-framework';

const trafficLightExample: StateMachineEditorData = {
  name: 'Traffic Light',
  states: [
    {
      id: 'red',
      name: 'Red',
      x: 100,
      y: 100,
      isInitial: true,
      isFinal: false,
      entryAction: 'stopTraffic()',
      width: 80,
      height: 60,
    },
    {
      id: 'yellow',
      name: 'Yellow',
      x: 300,
      y: 100,
      isInitial: false,
      isFinal: false,
      entryAction: 'caution()',
      width: 80,
      height: 60,
    },
    {
      id: 'green',
      name: 'Green',
      x: 500,
      y: 100,
      isInitial: false,
      isFinal: false,
      entryAction: 'allowTraffic()',
      width: 80,
      height: 60,
    },
  ],
  transitions: [
    {
      id: 't1',
      from: 'red',
      to: 'green',
      event: 'timer',
      guard: 'time > 30s',
    },
    {
      id: 't2',
      from: 'green',
      to: 'yellow',
      event: 'timer',
      guard: 'time > 25s',
    },
    {
      id: 't3',
      from: 'yellow',
      to: 'red',
      event: 'timer',
      guard: 'time > 5s',
    },
  ],
  initialStateId: 'red',
};

export function TrafficLightEditor() {
  const [data, setData] = useState(trafficLightExample);
  const [simulationActive, setSimulationActive] = useState(false);
  const [activeStateId, setActiveStateId] = useState('red');

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <StateMachineEditor
        initialData={data}
        onDataChange={setData}
        simulationMode={simulationActive}
        activeStateId={activeStateId}
      />
      <button onClick={() => setSimulationActive(!simulationActive)}>
        {simulationActive ? 'Stop Simulation' : 'Start Simulation'}
      </button>
    </div>
  );
}
```

## API Reference

### StateMachineEditor

Main component for visual state machine editing.

**Props:**
- `initialData?: StateMachineEditorData`
- `onDataChange?: (data) => void`
- `readOnly?: boolean`
- `simulationMode?: boolean`
- `activeStateId?: string`

### Canvas

Low-level canvas rendering component.

### PropertyPanel

Property editor for selected states/transitions.

### Toolbar

Toolbar with zoom and panel toggle controls.

## Performance

- Canvas-based rendering for efficient large state machines (100+ states)
- Lazy rendering: only visible elements drawn
- GPU acceleration via WebGL (future enhancement)

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Android Chrome)

## Accessibility

- Keyboard shortcuts: Alt+Click for transitions
- Screen reader support (ARIA labels)
- High contrast mode support
- Zoom levels from 50% to 300%

## Known Limitations

- Max ~200 states per FSM (use hierarchical states for larger machines)
- Self-loops render above the state node
- Curved transitions (Bezier) are simplified to straight lines

## Future Enhancements

- [ ] Hierarchical/composite states
- [ ] Parallel regions (orthogonal states)
- [ ] History states (shallow/deep)
- [ ] Choice pseudo-states
- [ ] Fork/join pseudo-states
- [ ] Undo/redo history
- [ ] Export to Graphviz/PlantUML
- [ ] Animation of transitions
- [ ] Multi-select and bulk operations
- [ ] Custom themes
- [ ] Collaborative editing

## Contributing

Contributions welcome! Please follow:
- Component structure in `StateMachineEditor.tsx`
- Test coverage in `__tests__/`
- TypeScript strict mode
- ESLint configuration

## License

Same as Tupan project
