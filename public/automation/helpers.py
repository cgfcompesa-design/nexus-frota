import os
import time
import logging
from playwright.sync_api import Page, TimeoutError

# Set up logging format
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("NexusFuelControl")

def take_screenshot(page: Page, step_name: str, output_dir: str = "screenshots") -> str:
    """
    Captures a screenshot of the current page state, securing diagnostic info on failure.
    """
    os.makedirs(output_dir, exist_ok=True)
    timestamp = int(time.time())
    filename = f"{output_dir}/{step_name}_{timestamp}.png"
    try:
        page.screenshot(path=filename, full_page=True)
        logger.info(f"Screenshot salvo em: {filename}")
        return filename
    except Exception as e:
        logger.error(f"Falha ao capturar screenshot para {step_name}: {e}")
        return ""

def dump_html_on_error(page: Page, step_name: str, output_dir: str = "error_dumps") -> str:
    """
    Dumps the raw HTML page source for deep triage in case of automation failure.
    """
    os.makedirs(output_dir, exist_ok=True)
    timestamp = int(time.time())
    filename = f"{output_dir}/{step_name}_{timestamp}.html"
    try:
        html = page.content()
        with open(filename, "w", encoding="utf-8") as f:
            f.write(html)
        logger.info(f"HTML dump salvo em: {filename}")
        return filename
    except Exception as e:
        logger.error(f"Falha ao realizar dump HTML para {step_name}: {e}")
        return ""

def wait_and_click(page: Page, selector: str, timeout_ms: int = 15000, retries: int = 2) -> bool:
    """
    Resilient waiter and clicker with retry logic.
    """
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Tentando clicar em '{selector}' (Tentativa {attempt}/{retries})...")
            # Smart wait for element to be visible and enabled
            element = page.locator(selector)
            element.wait_for(state="visible", timeout=timeout_ms)
            element.click(timeout=timeout_ms)
            logger.info(f"Clique bem-sucedido em '{selector}'")
            return True
        except TimeoutError:
            logger.warning(f"Timeout ao tentar interagir com '{selector}' na tentativa {attempt}.")
            if attempt == retries:
                raise
        except Exception as e:
            logger.error(f"Erro inesperado em click no seletor '{selector}': {e}")
            if attempt == retries:
                raise
            time.sleep(1)
    return False

def clean_monetary_value(val_str: str) -> float:
    """
    Converts a standard Brazilian currency string (e.g. '22.608,41' or 'R$ 22.608,41') into a float.
    """
    cleaned = val_str.replace("R$", "").replace(" ", "")
    # Remove thousand separators, replace decimal comma with dot
    cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        logger.error(f"Não foi possível converter o valor '{val_str}' para float.")
        raise
