extends Node
## Visual QA capture.
##
## Driven entirely by environment variables so the loop can screenshot any
## screen without touching game code:
##   QA_SHOT   output PNG path. Empty -> normal play, this node does nothing.
##   QA_FRAME  how many rendered frames to wait before capturing. Default 90.
##   QA_QUIT   "0" keeps the window open after capture. Default: quit.

const DEFAULT_FRAME := 90

func _ready() -> void:
	var out_path := OS.get_environment("QA_SHOT")
	if out_path.is_empty():
		return
	_capture_after_settle(out_path)

func _capture_after_settle(out_path: String) -> void:
	var frames := DEFAULT_FRAME
	var frame_env := OS.get_environment("QA_FRAME")
	if frame_env.is_valid_int():
		frames = maxi(1, frame_env.to_int())

	# Let the game boot, route to its start screen and settle into steady state.
	for _i in frames:
		await get_tree().process_frame

	# The viewport texture is only guaranteed current after the draw call.
	await RenderingServer.frame_post_draw

	var image := get_viewport().get_texture().get_image()
	var dir := out_path.get_base_dir()
	if not dir.is_empty():
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	var err := image.save_png(out_path)
	if err == OK:
		print("[qa] saved %s (%dx%d, frame %d)" % [out_path, image.get_width(), image.get_height(), frames])
	else:
		printerr("[qa] save failed: %s (error %d)" % [out_path, err])

	if OS.get_environment("QA_QUIT") != "0":
		get_tree().quit(0 if err == OK else 1)
