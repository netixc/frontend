use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Create tray menu
      let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let show_hide = MenuItem::with_id(app, "show_hide", "Show/Hide", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_hide, &quit])?;

      // Create system tray
      let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| {
          match event.id().as_ref() {
            "quit" => {
              app.exit(0);
            }
            "show_hide" => {
              if let Some(window) = app.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                  let _ = window.hide();
                } else {
                  let _ = window.show();
                  let _ = window.set_focus();
                }
              }
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            rect,
            ..
          } = event {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
              if window.is_visible().unwrap_or(false) {
                let _ = window.hide();
              } else {
                let _ = window.show();
                let _ = window.set_focus();

                // Position window below tray icon on macOS
                #[cfg(target_os = "macos")]
                {
                  if let Ok(window_size) = window.outer_size() {
                    use tauri::PhysicalPosition;
                    // Extract position from rect
                    if let tauri::Position::Physical(pos) = rect.position {
                      if let tauri::Size::Physical(size) = rect.size {
                        let x = pos.x + (size.width as i32 / 2) - (window_size.width as i32 / 2);
                        let y = pos.y + size.height as i32;
                        let _ = window.set_position(tauri::Position::Physical(PhysicalPosition { x, y }));
                      }
                    }
                  }
                }
              }
            }
          }
        })
        .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      // Hide window when it loses focus (menubar behavior)
      if let tauri::WindowEvent::Focused(false) = event {
        let _ = window.hide();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
