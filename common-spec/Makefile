.PHONY: generate typecheck

generate:
	tsp compile specs/
	buf generate generated/proto/

typecheck:
	tsc --noEmit
