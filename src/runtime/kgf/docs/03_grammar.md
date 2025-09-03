# Grammar Section (PEG flavor)

Supported constructs

- Sequence: `A B C`
- Choice: `A | B | C`
- Repetition: `X*`, `X+`, `X?`
- Grouping: `( … )`; Optional: `[ … ]` (equivalent to `?`)
- Labels: `name:RuleOrToken` capture the last matched lexeme of that position into label `name`.
- Token vs rule: an identifier is a token if declared in `lex`; otherwise it calls a rule.

Comments

- `#` starts a line comment until end of line; comments are ignored in the grammar.

Label propagation

- Labels propagate “upwards”. If a labeled child has a `_last` lexeme, it is promoted into the requested label name. Otherwise, a `null` placeholder is added when needed.

Start rule

- The first rule declared in the `grammar` section is used as the start rule for a file.

