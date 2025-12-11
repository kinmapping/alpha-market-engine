from shared.domain.models import Signal


class SignalPublisherService:
    """Publishes signals (placeholder)."""

    def __init__(self, publisher) -> None:
        self.publisher = publisher

    def publish(self, signal: Signal) -> None:
        # TODO: delegate to infrastructure publisher (Redis)
        raise NotImplementedError("Signal publish is not implemented yet.")

