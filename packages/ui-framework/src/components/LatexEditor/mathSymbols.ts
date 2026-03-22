/**
 * LaTeX math symbol library with autocomplete support
 * Organized by category for easy discovery
 */

export interface MathSymbol {
  name: string;           // Command name (without backslash)
  symbol: string;         // Unicode symbol or LaTeX rendering
  category: string;       // Category for grouping
  description: string;    // Human-readable description
  alternates?: string[];  // Alternative names
}

export const MATH_SYMBOLS: MathSymbol[] = [
  // Greek letters
  { name: 'alpha', symbol: 'α', category: 'Greek', description: 'Alpha' },
  { name: 'beta', symbol: 'β', category: 'Greek', description: 'Beta' },
  { name: 'gamma', symbol: 'γ', category: 'Greek', description: 'Gamma' },
  { name: 'delta', symbol: 'δ', category: 'Greek', description: 'Delta' },
  { name: 'epsilon', symbol: 'ε', category: 'Greek', description: 'Epsilon' },
  { name: 'zeta', symbol: 'ζ', category: 'Greek', description: 'Zeta' },
  { name: 'eta', symbol: 'η', category: 'Greek', description: 'Eta' },
  { name: 'theta', symbol: 'θ', category: 'Greek', description: 'Theta' },
  { name: 'iota', symbol: 'ι', category: 'Greek', description: 'Iota' },
  { name: 'kappa', symbol: 'κ', category: 'Greek', description: 'Kappa' },
  { name: 'lambda', symbol: 'λ', category: 'Greek', description: 'Lambda' },
  { name: 'mu', symbol: 'μ', category: 'Greek', description: 'Mu' },
  { name: 'nu', symbol: 'ν', category: 'Greek', description: 'Nu' },
  { name: 'xi', symbol: 'ξ', category: 'Greek', description: 'Xi' },
  { name: 'omicron', symbol: 'ο', category: 'Greek', description: 'Omicron' },
  { name: 'pi', symbol: 'π', category: 'Greek', description: 'Pi' },
  { name: 'rho', symbol: 'ρ', category: 'Greek', description: 'Rho' },
  { name: 'sigma', symbol: 'σ', category: 'Greek', description: 'Sigma' },
  { name: 'tau', symbol: 'τ', category: 'Greek', description: 'Tau' },
  { name: 'upsilon', symbol: 'υ', category: 'Greek', description: 'Upsilon' },
  { name: 'phi', symbol: 'φ', category: 'Greek', description: 'Phi' },
  { name: 'chi', symbol: 'χ', category: 'Greek', description: 'Chi' },
  { name: 'psi', symbol: 'ψ', category: 'Greek', description: 'Psi' },
  { name: 'omega', symbol: 'ω', category: 'Greek', description: 'Omega' },

  // Calculus operators
  { name: 'int', symbol: '∫', category: 'Calculus', description: 'Integral', alternates: ['integral'] },
  { name: 'oint', symbol: '∮', category: 'Calculus', description: 'Contour integral' },
  { name: 'partial', symbol: '∂', category: 'Calculus', description: 'Partial derivative' },
  { name: 'nabla', symbol: '∇', category: 'Calculus', description: 'Nabla/Del operator', alternates: ['del'] },
  { name: 'sum', symbol: '∑', category: 'Calculus', description: 'Summation' },
  { name: 'prod', symbol: '∏', category: 'Calculus', description: 'Product' },
  { name: 'infty', symbol: '∞', category: 'Calculus', description: 'Infinity' },
  { name: 'lim', symbol: 'lim', category: 'Calculus', description: 'Limit' },

  // Logical operators
  { name: 'forall', symbol: '∀', category: 'Logic', description: 'For all' },
  { name: 'exists', symbol: '∃', category: 'Logic', description: 'There exists' },
  { name: 'neg', symbol: '¬', category: 'Logic', description: 'Negation' },
  { name: 'wedge', symbol: '∧', category: 'Logic', description: 'Logical and' },
  { name: 'vee', symbol: '∨', category: 'Logic', description: 'Logical or' },
  { name: 'implies', symbol: '⟹', category: 'Logic', description: 'Implies' },
  { name: 'iff', symbol: '⟺', category: 'Logic', description: 'If and only if' },

  // Set operators
  { name: 'in', symbol: '∈', category: 'Sets', description: 'Element of' },
  { name: 'notin', symbol: '∉', category: 'Sets', description: 'Not element of' },
  { name: 'subset', symbol: '⊂', category: 'Sets', description: 'Subset' },
  { name: 'subseteq', symbol: '⊆', category: 'Sets', description: 'Subset or equal' },
  { name: 'supset', symbol: '⊃', category: 'Sets', description: 'Superset' },
  { name: 'supseteq', symbol: '⊇', category: 'Sets', description: 'Superset or equal' },
  { name: 'cup', symbol: '∪', category: 'Sets', description: 'Union' },
  { name: 'cap', symbol: '∩', category: 'Sets', description: 'Intersection' },
  { name: 'emptyset', symbol: '∅', category: 'Sets', description: 'Empty set' },

  // Relations
  { name: 'leq', symbol: '≤', category: 'Relations', description: 'Less than or equal' },
  { name: 'geq', symbol: '≥', category: 'Relations', description: 'Greater than or equal' },
  { name: 'neq', symbol: '≠', category: 'Relations', description: 'Not equal' },
  { name: 'approx', symbol: '≈', category: 'Relations', description: 'Approximately equal' },
  { name: 'equiv', symbol: '≡', category: 'Relations', description: 'Equivalent' },
  { name: 'propto', symbol: '∝', category: 'Relations', description: 'Proportional to' },
  { name: 'mid', symbol: '∣', category: 'Relations', description: 'Divides' },

  // Arrows
  { name: 'to', symbol: '→', category: 'Arrows', description: 'Right arrow', alternates: ['rightarrow'] },
  { name: 'leftarrow', symbol: '←', category: 'Arrows', description: 'Left arrow' },
  { name: 'leftrightarrow', symbol: '↔', category: 'Arrows', description: 'Left-right arrow' },
  { name: 'Rightarrow', symbol: '⇒', category: 'Arrows', description: 'Double right arrow' },
  { name: 'Leftarrow', symbol: '⇐', category: 'Arrows', description: 'Double left arrow' },
  { name: 'uparrow', symbol: '↑', category: 'Arrows', description: 'Up arrow' },
  { name: 'downarrow', symbol: '↓', category: 'Arrows', description: 'Down arrow' },

  // Accents/Modifiers
  { name: 'hat', symbol: 'ˆ', category: 'Accents', description: 'Hat/Circumflex accent' },
  { name: 'bar', symbol: '¯', category: 'Accents', description: 'Overline' },
  { name: 'dot', symbol: '˙', category: 'Accents', description: 'Dot accent' },
  { name: 'ddot', symbol: '¨', category: 'Accents', description: 'Double dot accent' },
  { name: 'tilde', symbol: '~', category: 'Accents', description: 'Tilde accent' },
  { name: 'vec', symbol: '→', category: 'Accents', description: 'Vector arrow' },
  { name: 'prime', symbol: '′', category: 'Accents', description: 'Prime symbol' },

  // Common math symbols
  { name: 'pm', symbol: '±', category: 'Operators', description: 'Plus or minus' },
  { name: 'times', symbol: '×', category: 'Operators', description: 'Multiplication' },
  { name: 'div', symbol: '÷', category: 'Operators', description: 'Division' },
  { name: 'cdot', symbol: '·', category: 'Operators', description: 'Center dot' },
  { name: 'ast', symbol: '*', category: 'Operators', description: 'Asterisk' },
  { name: 'sqrt', symbol: '√', category: 'Operators', description: 'Square root' },
  { name: 'cbrt', symbol: '∛', category: 'Operators', description: 'Cube root' },
  { name: 'therefore', symbol: '∴', category: 'Operators', description: 'Therefore' },
  { name: 'because', symbol: '∵', category: 'Operators', description: 'Because' },
];

export const LATEX_TEMPLATES_EXTENDED = [
  // Control Theory
  {
    id: 'transfer-function',
    label: 'Transfer Function',
    category: 'Control Theory',
    content: String.raw`
\section{Transfer Function}
\begin{equation}
G(s) = \frac{Y(s)}{U(s)} = \frac{b_m s^m + \cdots + b_0}{a_n s^n + \cdots + a_0}
\end{equation}

\subsection{Pole-Zero Analysis}
Poles: $s = -\sigma_i \pm j\omega_i$

Zeros: $s = -z_i$
`,
  },
  {
    id: 'pid-controller',
    label: 'PID Controller',
    category: 'Control Theory',
    content: String.raw`
\section{PID Controller}
\begin{equation}
u(t) = K_p e(t) + K_i \int_0^t e(\tau) d\tau + K_d \frac{de(t)}{dt}
\end{equation}

\begin{equation}
G_c(s) = K_p + \frac{K_i}{s} + K_d s
\end{equation}
`,
  },
  {
    id: 'state-space',
    label: 'State Space Model',
    category: 'Control Theory',
    content: String.raw`
\section{State Space Representation}
\begin{align}
\dot{\mathbf{x}}(t) &= \mathbf{A}\mathbf{x}(t) + \mathbf{B}\mathbf{u}(t) \\
\mathbf{y}(t) &= \mathbf{C}\mathbf{x}(t) + \mathbf{D}\mathbf{u}(t)
\end{align}

Where:
\begin{itemize}
\item $\mathbf{x}(t) \in \mathbb{R}^n$ is the state vector
\item $\mathbf{u}(t) \in \mathbb{R}^p$ is the input vector
\item $\mathbf{y}(t) \in \mathbb{R}^q$ is the output vector
\end{itemize}
`,
  },

  // Circuit Analysis
  {
    id: 'circuit-equations',
    label: 'Circuit Equations',
    category: 'Electrical',
    content: String.raw`
\section{Circuit Analysis}

\subsection{Ohm's Law}
\begin{equation}
V = I R
\end{equation}

\subsection{Kirchhoff's Voltage Law (KVL)}
\begin{equation}
\sum_{i=1}^{n} V_i = 0
\end{equation}

\subsection{Kirchhoff's Current Law (KCL)}
\begin{equation}
\sum_{j=1}^{m} I_j = 0
\end{equation}
`,
  },
  {
    id: 'rc-circuit',
    label: 'RC Circuit Analysis',
    category: 'Electrical',
    content: String.raw`
\section{RC Circuit Time Response}

\subsection{Charging}
\begin{equation}
V_C(t) = V_s(1 - e^{-t/RC})
\end{equation}

\subsection{Discharging}
\begin{equation}
V_C(t) = V_0 e^{-t/RC}
\end{equation}

Time constant: $\tau = RC$
`,
  },
  {
    id: 'rl-circuit',
    label: 'RL Circuit Analysis',
    category: 'Electrical',
    content: String.raw`
\section{RL Circuit}

\subsection{Charging}
\begin{equation}
i(t) = \frac{V_s}{R}(1 - e^{-Rt/L})
\end{equation}

Time constant: $\tau = L/R$

\subsection{Energy Storage}
\begin{equation}
E_L = \frac{1}{2}Li^2
\end{equation}
`,
  },
  {
    id: 'fourier-series',
    label: 'Fourier Series',
    category: 'Signal Processing',
    content: String.raw`
\section{Fourier Series Representation}

\begin{equation}
f(t) = \frac{a_0}{2} + \sum_{n=1}^{\infty} \left[ a_n \cos(n\omega_0 t) + b_n \sin(n\omega_0 t) \right]
\end{equation}

Where:
\begin{align}
a_n &= \frac{2}{T} \int_0^T f(t) \cos(n\omega_0 t) dt \\
b_n &= \frac{2}{T} \int_0^T f(t) \sin(n\omega_0 t) dt
\end{align}
`,
  },
  {
    id: 'bode-plot',
    label: 'Bode Plot Analysis',
    category: 'Signal Processing',
    content: String.raw`
\section{Bode Plot}

\subsection{Magnitude Response}
\begin{equation}
|G(j\omega)| = \sqrt{[\text{Re}(G(j\omega))]^2 + [\text{Im}(G(j\omega))]^2}
\end{equation}

In decibels:
\begin{equation}
20 \log_{10} |G(j\omega)| \text{ (dB)}
\end{equation}

\subsection{Phase Response}
\begin{equation}
\angle G(j\omega) = \arctan\left(\frac{\text{Im}(G(j\omega))}{\text{Re}(G(j\omega))}\right)
\end{equation}
`,
  },

  // Thermal Analysis
  {
    id: 'thermal-resistance',
    label: 'Thermal Resistance Network',
    category: 'Thermal',
    content: String.raw`
\section{Thermal Resistance Analysis}

\subsection{Thermal Circuit Analogy}
\begin{align}
\Delta T &= R_\text{th} \cdot Q \\
Q &= \frac{\Delta T}{R_\text{th}}
\end{align}

\subsection{Series Thermal Resistances}
\begin{equation}
R_\text{total} = R_1 + R_2 + \cdots + R_n
\end{equation}

\subsection{Parallel Thermal Resistances}
\begin{equation}
\frac{1}{R_\text{total}} = \frac{1}{R_1} + \frac{1}{R_2} + \cdots + \frac{1}{R_n}
\end{equation}
`,
  },
  {
    id: 'convection-heat',
    label: 'Convection Heat Transfer',
    category: 'Thermal',
    content: String.raw`
\section{Convection Heat Transfer}

\subsection{Newton's Law of Cooling}
\begin{equation}
Q = h A \Delta T
\end{equation}

Where:
\begin{itemize}
\item $h$ is the convection coefficient (W/m²·K)
\item $A$ is the surface area (m²)
\item $\Delta T$ is the temperature difference (K)
\end{itemize}

\subsection{Nusselt Number}
\begin{equation}
Nu = \frac{hL_c}{k}
\end{equation}
`,
  },

  // Mechanics
  {
    id: 'newtons-laws',
    label: "Newton's Laws of Motion",
    category: 'Mechanics',
    content: String.raw`
\section{Newton's Laws}

\subsection{First Law}
An object at rest stays at rest unless acted upon by a force.

\subsection{Second Law}
\begin{equation}
\mathbf{F} = m\mathbf{a}
\end{equation}

\subsection{Third Law}
For every action, there is an equal and opposite reaction.
`,
  },
  {
    id: 'lagrangian',
    label: 'Lagrangian Mechanics',
    category: 'Mechanics',
    content: String.raw`
\section{Lagrangian Formulation}

\subsection{Lagrangian}
\begin{equation}
\mathcal{L} = T - V
\end{equation}

\subsection{Euler-Lagrange Equation}
\begin{equation}
\frac{d}{dt}\frac{\partial \mathcal{L}}{\partial \dot{q}_i} - \frac{\partial \mathcal{L}}{\partial q_i} = 0
\end{equation}
`,
  },
];

export function getSymbolByName(name: string): MathSymbol | undefined {
  return MATH_SYMBOLS.find((sym) => sym.name === name || sym.alternates?.includes(name));
}

export function searchSymbols(query: string): MathSymbol[] {
  const lowerQuery = query.toLowerCase();
  return MATH_SYMBOLS.filter(
    (sym) =>
      sym.name.includes(lowerQuery) ||
      sym.description.toLowerCase().includes(lowerQuery) ||
      sym.alternates?.some((alt) => alt.includes(lowerQuery))
  );
}

export function getSymbolsByCategory(category: string): MathSymbol[] {
  return MATH_SYMBOLS.filter((sym) => sym.category === category);
}

export function getCategories(): string[] {
  const categories = new Set(MATH_SYMBOLS.map((sym) => sym.category));
  return Array.from(categories).sort();
}
