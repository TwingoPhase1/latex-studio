package data

// EquationTemplate defines a curated starter formula.
type EquationTemplate struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Latex       string `json:"latex"`
}

// Templates contains all 13 curated mathematical, physical, and chemical examples.
var Templates = []EquationTemplate{
	{
		ID:          "quadratic",
		Title:       "Équation du second degré",
		Category:    "Classiques",
		Description: "Formule des racines avec discriminant Δ",
		Latex:       `x_{1,2} = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}, \quad \Delta = b^2 - 4ac`,
	},
	{
		ID:          "gaussian",
		Title:       "Intégrale gaussienne",
		Category:    "Analyse",
		Description: "Intégrale impropre classique sur ℝ",
		Latex:       `\int_{-\infty}^{+\infty} e^{-x^2}\,dx = \sqrt{\pi}`,
	},
	{
		ID:          "euler-product",
		Title:       "Produit eulérien (Zêta)",
		Category:    "Analyse",
		Description: "Relation entre la fonction ζ de Riemann et les nombres premiers",
		Latex:       `\zeta(s) = \sum_{n=1}^{\infty} \frac{1}{n^s} = \prod_{\substack{p \leq x \\ p \text{ premier}}} \frac{1}{1 - p^{-s}}`,
	},
	{
		ID:          "double-sum",
		Title:       "Somme sous double condition",
		Category:    "Algèbre",
		Description: "Utilisation de \\substack pour indexer une somme double",
		Latex:       `\sum_{\substack{1 \leq i \leq n \\ i \neq j}} P(i, j)`,
	},
	{
		ID:          "piecewise",
		Title:       "Fonction par morceaux",
		Category:    "Analyse",
		Description: "Définition de la valeur absolue avec \\cases",
		Latex:       `|x| = \begin{cases} x & \text{si } x \geq 0 \\ -x & \text{si } x < 0 \end{cases}`,
	},
	{
		ID:          "mapping",
		Title:       "Application mathématique",
		Category:    "Algèbre",
		Description: "Notation complète d'une fonction et de son image",
		Latex:       `\begin{array}{rccl} f : & I & \longrightarrow & J \\ & x & \longmapsto & f(x) \end{array}`,
	},
	{
		ID:          "aligned-system",
		Title:       "Alignement d'égalités",
		Category:    "Classiques",
		Description: "Chaîne d'égalités alignées sur le signe =",
		Latex:       `\begin{aligned} A &= B + C \\ &= D + E \\ &= \boxed{F} \end{aligned}`,
	},
	{
		ID:          "commutative",
		Title:       "Diagramme matriciel annoté",
		Category:    "Algèbre",
		Description: "Flèches annotées avec \\overset et matrices",
		Latex:       `\begin{pmatrix} a & b \\ c & d \end{pmatrix} \overset{A}{\longrightarrow} \begin{pmatrix} a' & b' \\ c' & d' \end{pmatrix} \cong \mathbb{R}^2`,
	},
	{
		ID:          "braces-annotation",
		Title:       "Annotations overbrace / underbrace",
		Category:    "Classiques",
		Description: "Mettre en évidence des sous-expressions",
		Latex:       `\overbrace{a + b + \cdots + z}^{\text{26 termes}} = \underbrace{x_1 + x_2}_{\text{somme partielle}}`,
	},
	{
		ID:          "bayes",
		Title:       "Théorème de Bayes",
		Category:    "Classiques",
		Description: "Probabilité conditionnelle a posteriori",
		Latex:       `P(A \mid B) = \frac{P(B \mid A)\,P(A)}{P(B)}`,
	},
	{
		ID:          "maxwell",
		Title:       "Équations de Maxwell",
		Category:    "Physique",
		Description: "Formulation différentielle dans le vide (package physics)",
		Latex:       `\begin{aligned} \div \mathbf{E} &= \frac{\rho}{\varepsilon_0} & \curl \mathbf{E} &= -\pdv{\mathbf{B}}{t} \\ \div \mathbf{B} &= 0 & \curl \mathbf{B} &= \mu_0 \mathbf{J} + \mu_0 \varepsilon_0 \pdv{\mathbf{E}}{t} \end{aligned}`,
	},
	{
		ID:          "schrodinger",
		Title:       "Équation de Schrödinger",
		Category:    "Physique",
		Description: "Équation d'évolution quantique en notation de Dirac",
		Latex:       `i\hbar \pdv{t} \ket{\Psi(t)} = \hat{H} \ket{\Psi(t)}`,
	},
	{
		ID:          "chemistry-eq",
		Title:       "Équilibre chimique & pH",
		Category:    "Chimie",
		Description: "Réaction réversible et constante d'acidité (mhchem)",
		Latex:       `\ce{CH3COOH + H2O <=> CH3COO- + H3O+}, \quad K_a = 1.8 \times 10^{-5}`,
	},
}
