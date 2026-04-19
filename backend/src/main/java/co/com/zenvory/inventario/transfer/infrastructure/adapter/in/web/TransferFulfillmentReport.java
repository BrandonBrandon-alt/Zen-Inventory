package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

public record TransferFulfillmentReport(
        Long totalTransfers,
        Long deliveredTransfers,
        Long delayedTransfers,
        Double onTimePercentage,
        Double averageDelayHours
) {}
