import './App.css'
import { Graph } from '@tupan/core-ts'
import { NodeEditor } from '@tupan/ui-framework'

function App() {
  const graph = new Graph()

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tupan</h1>
        <p>Comprehensive Mechatronics Engineering Platform</p>
      </header>

      <main className="app-main">
        <div className="editor-container">
          <NodeEditor graph={graph} />
        </div>
      </main>

      <footer className="app-footer">
        <p>Version 0.1.0 - Early Development</p>
      </footer>
    </div>
  )
}

export default App
