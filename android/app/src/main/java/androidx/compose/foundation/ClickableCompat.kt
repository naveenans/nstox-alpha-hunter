package androidx.compose.foundation

import androidx.compose.ui.Modifier

/**
 * Compatibility helper for the dashboard's explicit fully-qualified clickable call.
 * Keeps the main screen concise while delegating to Compose Foundation's Modifier.clickable extension.
 */
fun clickable(onClick: () -> Unit): Modifier = Modifier.clickable(onClick = onClick)
