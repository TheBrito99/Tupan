/**
 * Petri Net Property Panel
 *
 * Edit properties of selected places, transitions, and arcs
 */

import React, { useState } from 'react';
import {
  PetriNetEditorData,
  PlaceNodeData,
  TransitionNodeData,
  ArcData,
} from './types';
import styles from './PetriNetEditor.module.css';

export interface PropertyPanelProps {
  data: PetriNetEditorData;
  selectedPlaceId?: string;
  selectedTransitionId?: string;
  selectedArcId?: string;
  onUpdatePlace: (placeId: string, updates: Partial<PlaceNodeData>) => void;
  onUpdateTransition: (transitionId: string, updates: Partial<TransitionNodeData>) => void;
  onUpdateArc: (arcId: string, updates: Partial<ArcData>) => void;
  onDeletePlace: (placeId: string) => void;
  onDeleteTransition: (transitionId: string) => void;
  onDeleteArc: (arcId: string) => void;
  readOnly?: boolean;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  data,
  selectedPlaceId,
  selectedTransitionId,
  selectedArcId,
  onUpdatePlace,
  onUpdateTransition,
  onUpdateArc,
  onDeletePlace,
  onDeleteTransition,
  onDeleteArc,
  readOnly = false,
}) => {
  const selectedPlace = selectedPlaceId
    ? data.places.find(p => p.id === selectedPlaceId)
    : undefined;

  const selectedTransition = selectedTransitionId
    ? data.transitions.find(t => t.id === selectedTransitionId)
    : undefined;

  const selectedArc = selectedArcId
    ? data.arcs.find(a => a.id === selectedArcId)
    : undefined;

  if (!selectedPlace && !selectedTransition && !selectedArc) {
    return (
      <div className={styles.propertyPanel}>
        <div className={styles.panelHeader}>Properties</div>
        <div className={styles.panelContent}>
          <p style={{ color: '#999', textAlign: 'center' }}>
            Select a place, transition, or arc to edit
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.propertyPanel}>
      <div className={styles.panelHeader}>
        Properties
        {selectedPlace && ` (Place: ${selectedPlace.name})`}
        {selectedTransition && ` (Transition: ${selectedTransition.name})`}
        {selectedArc && ' (Arc)'}
      </div>

      <div className={styles.panelContent}>
        {selectedPlace && (
          <PlacePropertyEditor
            place={selectedPlace}
            onUpdate={onUpdatePlace}
            onDelete={onDeletePlace}
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

        {selectedArc && (
          <ArcPropertyEditor
            arc={selectedArc}
            onUpdate={onUpdateArc}
            onDelete={onDeleteArc}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  );
};

interface PlacePropertyEditorProps {
  place: PlaceNodeData;
  onUpdate: (placeId: string, updates: Partial<PlaceNodeData>) => void;
  onDelete: (placeId: string) => void;
  readOnly?: boolean;
}

const PlacePropertyEditor: React.FC<PlacePropertyEditorProps> = ({
  place,
  onUpdate,
  onDelete,
  readOnly = false,
}) => {
  const [name, setName] = useState(place.name);
  const [tokens, setTokens] = useState(place.tokens);
  const [capacity, setCapacity] = useState(place.capacity?.toString() || '');

  return (
    <div className={styles.propertySection}>
      <div className={styles.propertyField}>
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => onUpdate(place.id, { name })}
          disabled={readOnly}
          className={styles.input}
        />
      </div>

      <div className={styles.propertyField}>
        <label>Initial Tokens</label>
        <input
          type="number"
          min="0"
          value={tokens}
          onChange={e => setTokens(parseInt(e.target.value) || 0)}
          onBlur={() => onUpdate(place.id, { tokens })}
          disabled={readOnly}
          className={styles.input}
        />
      </div>

      <div className={styles.propertyField}>
        <label>Capacity (infinite if blank)</label>
        <input
          type="number"
          min="1"
          value={capacity}
          onChange={e => setCapacity(e.target.value)}
          onBlur={() =>
            onUpdate(place.id, {
              capacity: capacity ? parseInt(capacity) : undefined,
            })
          }
          disabled={readOnly}
          className={styles.input}
          placeholder="Optional"
        />
      </div>

      {!readOnly && (
        <button
          className={styles.deleteButton}
          onClick={() => onDelete(place.id)}
        >
          Delete Place
        </button>
      )}
    </div>
  );
};

interface TransitionPropertyEditorProps {
  transition: TransitionNodeData;
  onUpdate: (transitionId: string, updates: Partial<TransitionNodeData>) => void;
  onDelete: (transitionId: string) => void;
  readOnly?: boolean;
}

const TransitionPropertyEditor: React.FC<TransitionPropertyEditorProps> = ({
  transition,
  onUpdate,
  onDelete,
  readOnly = false,
}) => {
  const [name, setName] = useState(transition.name);

  return (
    <div className={styles.propertySection}>
      <div className={styles.propertyField}>
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => onUpdate(transition.id, { name })}
          disabled={readOnly}
          className={styles.input}
        />
      </div>

      <div className={styles.propertyField}>
        <label>
          <input
            type="checkbox"
            checked={transition.isEnabled}
            onChange={e => onUpdate(transition.id, { isEnabled: e.target.checked })}
            disabled={readOnly}
          />
          Is Enabled
        </label>
      </div>

      <div className={styles.infoBox}>
        <p>
          <strong>Enabled:</strong> {transition.isEnabled ? 'Yes' : 'No'}
        </p>
        <p style={{ fontSize: '11px', color: '#999' }}>
          A transition is enabled when all input places have sufficient tokens.
        </p>
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

interface ArcPropertyEditorProps {
  arc: ArcData;
  onUpdate: (arcId: string, updates: Partial<ArcData>) => void;
  onDelete: (arcId: string) => void;
  readOnly?: boolean;
}

const ArcPropertyEditor: React.FC<ArcPropertyEditorProps> = ({
  arc,
  onUpdate,
  onDelete,
  readOnly = false,
}) => {
  const [weight, setWeight] = useState(arc.weight);

  return (
    <div className={styles.propertySection}>
      <div className={styles.propertyField}>
        <label>Arc Weight</label>
        <input
          type="number"
          min="1"
          value={weight}
          onChange={e => setWeight(parseInt(e.target.value) || 1)}
          onBlur={() => onUpdate(arc.id, { weight })}
          disabled={readOnly}
          className={styles.input}
        />
      </div>

      <div className={styles.propertyField}>
        <label>
          <input
            type="checkbox"
            checked={arc.type === 'inhibitor'}
            onChange={e =>
              onUpdate(arc.id, { type: e.target.checked ? 'inhibitor' : 'normal' })
            }
            disabled={readOnly}
          />
          Inhibitor Arc
        </label>
      </div>

      <div className={styles.infoBox}>
        <p style={{ fontSize: '11px', color: '#999' }}>
          <strong>Inhibitor:</strong> If checked, this arc blocks transition firing when the
          source place has tokens.
        </p>
      </div>

      {!readOnly && (
        <button
          className={styles.deleteButton}
          onClick={() => onDelete(arc.id)}
        >
          Delete Arc
        </button>
      )}
    </div>
  );
};
