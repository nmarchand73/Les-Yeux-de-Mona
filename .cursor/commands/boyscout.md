# Boy Scout Code Review

Analyze the current file(s) and identify opportunities to apply the "Leave the code cleaner than you found it" principle.

## Instructions

Review the code and suggest **at least one small improvement** that can be made. Focus on:

1. **Typos and Grammar**: Check for spelling errors in comments, strings, documentation, and identifiers
2. **Naming**: Identify variables, functions, classes, modules, or any identifiers that could have clearer names
3. **Code Structure**: Look for opportunities to extract functions/methods, simplify logic, reduce duplication, or improve organization
4. **Documentation**: Find places where comments, docstrings, or documentation would improve understanding
5. **Dead Code**: Identify unused variables, functions, imports, commented-out code, or unreachable code
6. **Formatting**: Check for inconsistent indentation, spacing, style, or formatting that doesn't match project conventions
7. **Simplification**: Look for complex conditionals, nested structures, convoluted logic, or unnecessary complexity that could be simplified
8. **Conventions**: Identify code that doesn't follow the project's style guide, naming conventions, or architectural patterns

## Output Format

For each improvement opportunity found, provide:

- **Type**: What kind of improvement (typo, naming, structure, documentation, dead code, formatting, simplification, etc.)
- **Location**: Where in the code (file path, line number, function/method/class name)
- **Current State**: What the code looks like now (with context)
- **Suggested Improvement**: What the improvement would be (with example if helpful)
- **Impact**: Why this improvement matters (readability, maintainability, consistency, etc.)
- **Language/Context**: Note the programming language and any relevant context

## Priority

Focus on improvements that are:
- **Low-risk**: Won't break existing functionality or introduce bugs
- **High-value**: Provide clear benefit to code quality, readability, or maintainability
- **Contextual**: Related to the code being worked on (don't refactor unrelated code)
- **Language-appropriate**: Use conventions and patterns appropriate to the programming language
- **Project-consistent**: Follow the existing project's style and patterns

## Scope

This analysis should work for any programming language (JavaScript, Python, Java, C++, TypeScript, Go, Rust, etc.) and any type of project (web apps, APIs, libraries, scripts, etc.).

Remember: The goal is incremental improvement. Even fixing a single typo, improving one variable name, or adding one clarifying comment counts as leaving the code cleaner than you found it.

