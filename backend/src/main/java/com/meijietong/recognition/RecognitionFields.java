package com.meijietong.recognition;

public record RecognitionFields(
        String name,
        String role,
        String phone,
        String identity,
        String outboundTransport,
        String outboundDate,
        String outboundRoute,
        String outboundTrain,
        String outboundStation,
        String outboundTime,
        String outboundArrival,
        String returnTransport,
        String returnDate,
        String returnRoute,
        String returnTrain,
        String returnStation,
        String returnTime,
        String returnArrival,
        String hotelDate,
        String notes) {
}
