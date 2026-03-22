/**
 * State Machine Property Panel
 *
 * Edit properties of selected states and transitions
 */

import React, { useState } from 'react';
import {
  StateMachineEditorData,
  StateNodeData,
  TransitionData,
} from './types';
import styles from './StateMachineEditor.module.css';

export interface PropertyPanelProps {
  data: StateMachineEditorData;
  selectedStateId?: string;
  selectedTransitionId?: string;
  onUpdateState: (stateId: string, updates: Partial<StateNodeData>) => void;
  onUpdateTransition: (transitionId: string, updates: Partial<TransitionData>) => void;
  onDeleteState: (stateId: string) => void;
  onDeleteTransition: (transitionId: string) => void;
  onSelectState: (stateId: string) => void;
  readOnly?: boolean;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  data,
  selectedStateId,
  selectedTransitionId,
  onUpdateState,
  onUpdateTransition,
  onDeleteState,
  onDeleteTransition,
  onSelectState,
  readOnly = false,
}) => {
  const selectedState = selectedStateId
    ? data.states.find(s => s.id === selectedStateId)
    : undefined;

  const selectedTransition = selectedTransitionId
    ? data.transitions.find(t => t.id === selectedTransitionId)
    : undefined;

  if (!selectedState && !selectedTransition) {
    return (
      <div className={styles.propertyPanel}>
        <div className={styles.panelHeader}>Properties</div>
        <div className={styles.panelContent}>
          <p style={{ color: '#999', textAlign: 'center' }}>
            Select a state or transition to edit properties
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.propertyPanel}>
      <div className={styles.panelHeader}>
        Properties {selectedState && `(State: ${selectedState.name})`}
        {selectedTransition && `(Transition: ${selectedTransition.event})`}
      </div>

      <div className={styles.panelContent}>
        {selectedState && (
          <StatePropertyEditor
            state={selectedState}
            onUpdate={onUpdateState}
            onDelete={onDeleteState}
            readOnly={readOnly}
          />
        )}

        {selectedTransition && (
          <TransitionPropertyEditor
            transition={selectedTransition}
            onUpdate={onUpdateTransition}
            onDelete={onDeleteTransition}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  );
};

interface StatePropertyEditorProps {
  state: StateNodeData;
  onUpdate: (stateId: string, updates: Partial<StateNodeData>) => void;
  onDelete: (stateId: string) => void;
  readOnly?: boolean;
}

const StatePropertyEditor: React.FC<StatePropertyEditorProps> = ({
  state,
  onUpdate,
  onDelete,
  readOnly = false,
}) => {
  const [name, setName] = useState(state.name);
  const [entryAction, setEntryAction] = useState(state.entryAction || '');
  const [exitAction, setExitAction] = useState(state.exitAction || '');

  return (
    <div className={styles.propertySection}>
      <div className={styles.propertyField}>
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => onUpdate(state.id, { name })}
          disabled={readOnly}
          className={styles.input}
        />
      </div>

      <div className={styles.propertyField}>
        <label>
          <input
            type="checkbox"
            checked={state.isInitial}
            onChange={e => onUpdate(state.id, { isInitial: e.target.checked })}
            disabled={readOnly}
          />
          Initial State
        </label>
      </div>

      <div className={styles.propertyField}>
        <label>
          <input
            type="checkbox"
            checked={state.isFinal}
            onChange={e => onUpdate(state.id, { isFinal: e.target.checked })}
            disabled={readOnly}
          />
          Final State
        </label>
      </div>

      <div className={styles.propertyField}>
        <label>Entry Action</label>
        <input
          type="text"
          value={entryAction}
          onChange={e => setEntryAction(e.target.value)}
          onBlur={() => onUpdate(state.id, { entryAction })}
          placeholder="e.g., initialize()"
          disabled={readOnly}
          className={styles.input}
        />
      </div>

      <div className={styles.propertyField}>
        <label>Exit Action</label>
        <input
          type="text"
          value={exitAction}
          onChange={e => setExitAction(e.target.value)}
          onBlur={() => onUpdate(state.id, { exitAction })}
          placeholder="e.g., cleanup()"
          disabled={readOnly}
          className={styles.input}
        />
      </div>

      {!readOnly && (
        <button
          className={styles.deleteButton}
          onClick={() => onDelete(state.id)}
        >
          Delete State
        </button>
      )}
    </div>
  );
};

interface TransitionPropertyEditorProps {
  transition: TransitionData;
  onUpdate: (transitionId: string, updates: Partial<TransitionData>) => void;
  onDelete: (transitionId: string) => void;
  readOnly?: boolean;
}

const TransitionPropertyEditor: React.FC<TransitionPropertyEditorProps> = ({
  transition,
  onUpdate,
  onDelete,
  readOnly = false,
}) => {
  const [event, setEvent] = useState(transition.event);
  const [guard, setGuard] = useState(transition.guard || '');
  const [action, setAction] = useState(transition.action || '');

  return (
    <div className={styles.propertySection}>
      <div className={styles.propertyField}>
        <label>Event</label>
        <input
          type="text"
          value={event}
          onChange={e => setEvent(e.target.value)}
          onBlur={() => onUpdate(transition.id, { event })}
          disabled={readOnly}
          className={styles.input}
        />
      </div>

      <div className={styles.propertyField}>
        <label>Guard Condition</label>
        <input
          type="text"
          value={guard}
          onChange={e => setGuard(e.target.value)}
          onBlur={() => onUpdate(transition.id, { guard })}
          placeholder="e.g., x > 5"
          disabled={readOnly}
          className={styles.input}
        />
      </div>

      <div className={styles.propertyField}>
        <label>Action</label>
        <input
          type="text"
          value={action}
          onChange={e => setAction(e.target.value)}
          onBlur={() => onUpdate(transition.id, { action })}
          placeholder="e.g., log('transition')"
          disabled={readOnly}
          className={styles.input}
        />
      </div>

      {!readOnly && (
        <button
          className={styles.deleteButton}
          onClick={() => onDelete(transition.id)}
        >
          Delete Transition
        </button>
      )}
    </div>
  );
};
