class DBLogger:
    """Stub logger that would persist logs to DB."""

    def __init__(self, url: str) -> None:
        self.url = url

    def log_signal(self, signal) -> None:
        # TODO: implement structured logging
        raise NotImplementedError

    def log_ohlcv(self, ohlcv) -> None:
        # TODO: implement structured logging
        raise NotImplementedError

