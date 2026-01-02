---
description: "Enforce the 'Leave the code cleaner than you found it' principle - make small improvements whenever editing code"
alwaysApply: true
---

# Boy Scout Rule: Leave the Code Cleaner Than You Found It

## Core Principle

**"Always check a module in cleaner than when you checked it out."**

The Boy Scouts have a rule: "Always leave the campground cleaner than you found it." If you find a mess on the ground, you clean it up regardless of who might have made it. You intentionally improve the environment for the next group of campers.

This principle, from Robert C. Martin (Uncle Bob), applies the same philosophy to code: **always make some effort, no matter how small, to improve the module you're working on.**

You don't have to make every module perfect before you check it in. You simply have to make it **a little bit better** than when you checked it out. This means:
- Any code you add to a module must be clean
- You clean up at least one other thing before you check in
- You improve the code regardless of who the original author was

The result: instead of relentless deterioration, our systems gradually get better and better as they evolve. Teams care for the system as a whole, rather than just individuals caring for their own small part.

## Your Responsibilities

When editing any file, you MUST:

1. **Keep your new code clean**: Any code you add to a module must be clean, well-named, and properly documented
2. **Clean up at least one thing**: Before checking in, clean up at least one other thing in the module (beyond your changes)
3. **Fix obvious issues**: Correct typos, fix formatting inconsistencies, remove commented-out code, fix broken imports
4. **Improve naming**: Rename variables, functions, classes, or modules for better clarity when you encounter unclear names
5. **Extract reusable code**: When you see duplicated logic or overly long functions/methods, suggest extracting reusable code
6. **Add documentation**: Add or improve comments, docstrings, or documentation, especially for complex logic or non-obvious behavior
7. **Simplify code**: Look for opportunities to simplify conditional logic, reduce nesting, improve readability, or remove unnecessary complexity
8. **Follow conventions**: Ensure code follows the project's style guide, naming conventions, and architectural patterns

## Guidelines

- **A little bit better**: You don't have to make the module perfect - just make it a little bit better than when you checked it out
- **At least one cleanup**: Always clean up at least one thing in the module beyond your own changes
- **Low-risk, high-value**: Focus on improvements that are safe and provide clear value
- **Incremental**: Make small, focused improvements rather than large refactorings
- **Context-aware**: Only make improvements that are relevant to the code you're already touching
- **Team care**: Care for the system as a whole, not just your own small part
- **Language-agnostic**: Apply these principles regardless of programming language (JavaScript, Python, Java, C++, etc.)
- **Respect existing patterns**: Follow the project's existing code style and patterns rather than imposing your own preferences

## What Counts as an Improvement

- Fixing typos or grammar in comments, strings, and documentation
- Improving variable/function/class names for clarity (e.g., `x` → `userCount`, `temp` → `filteredItems`, `data` → `userData`)
- Extracting a small function/method from duplicated code
- Adding clarifying comments or documentation for complex logic
- Removing dead code, unused variables, or commented-out code
- Fixing inconsistent formatting, indentation, or style
- Simplifying complex conditionals, nested structures, or convoluted logic
- Improving error messages, logging, or user-facing text
- Adding type hints, annotations, or documentation comments (appropriate to the language)
- Consolidating duplicate code patterns
- Improving import/require organization
- Fixing inconsistent naming conventions (camelCase vs snake_case, etc.)

## Examples

**Example 1: Improving Variable Names**
```javascript
// Before: Unclear variable name
let x = items.filter(i => i.category === 'active');

// After: Descriptive variable name
let activeItems = items.filter(item => item.category === 'active');
```

**Example 2: Removing Dead Code**
```python
# Before: Commented-out code
# def old_function():
#     return None

# After: Removed
# (code removed entirely)
```

**Example 3: Extracting Duplication**
```javascript
// Before: Duplicated logic
if (user.age >= 18 && user.verified) { /* ... */ }
if (admin.age >= 18 && admin.verified) { /* ... */ }

// After: Extracted function
function isEligible(person) {
    return person.age >= 18 && person.verified;
}
if (isEligible(user)) { /* ... */ }
if (isEligible(admin)) { /* ... */ }
```

**Example 4: Adding Documentation**
```python
# Before: Unclear purpose
def process(data):
    return sorted(data, key=lambda x: x[1])

# After: Clear documentation
def process(data):
    """
    Sort data by the second element of each tuple.
    
    Args:
        data: List of tuples to sort
        
    Returns:
        Sorted list of tuples
    """
    return sorted(data, key=lambda x: x[1])
```

## Manual Code Review

For a focused code review, users can invoke the `/boyscout` command to analyze files and get specific improvement suggestions.

@../commands/boyscout.md

## Benefits

- **Prevents relentless deterioration**: Instead of systems getting worse over time, they gradually get better
- **Distributes refactoring**: The entire team shares responsibility for code quality, not just individuals
- **Encourages continuous improvement**: Small, incremental improvements compound over time
- **Reduces technical debt**: Technical debt is paid down incrementally with each change
- **Team ownership**: Teams care for the system as a whole, fostering collective code ownership

## Remember

You don't have to make every module perfect before you check it in. You simply have to make it **a little bit better** than when you checked it out. 

As Robert Stephenson Smyth Baden-Powell, the father of scouting, wrote: *"Try and leave this world a little better than you found it."*

Apply this to code: **Always check a module in cleaner than when you checked it out.**

