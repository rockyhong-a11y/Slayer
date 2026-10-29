class_name Ui
extends Object
## Minimal helpers for the code-built placeholder UI.
## Labels are ASCII on purpose: the bundled font has no Hangul glyphs and
## Korean text would capture as tofu boxes in QA screenshots.

static func label(parent: Node, text: String, pos: Vector2, size: int = 20, color: Color = Color.WHITE) -> Label:
	var node := Label.new()
	node.text = text
	node.position = pos
	node.add_theme_font_size_override("font_size", size)
	node.add_theme_color_override("font_color", color)
	parent.add_child(node)
	return node

static func bar(parent: Node, pos: Vector2, size: Vector2, ratio: float, color: Color) -> void:
	var back := ColorRect.new()
	back.position = pos
	back.size = size
	back.color = Color(0.15, 0.15, 0.18)
	parent.add_child(back)
	var fill := ColorRect.new()
	fill.position = pos
	fill.size = Vector2(size.x * clampf(ratio, 0.0, 1.0), size.y)
	fill.color = color
	parent.add_child(fill)

static func backdrop(parent: Node, color: Color) -> void:
	var rect := ColorRect.new()
	rect.color = color
	parent.add_child(rect)
	# ...and_offsets_preset, not set_anchors_preset: the latter keeps the
	# current offsets, which for a fresh node means a zero-sized rect.
	rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
