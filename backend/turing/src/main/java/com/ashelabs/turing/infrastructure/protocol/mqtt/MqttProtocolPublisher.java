package com.ashelabs.turing.infrastructure.protocol.mqtt;

import com.ashelabs.turing.domain.device.protocol.ProtocolPublisher;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/**
 * MQTT protocol publisher for mitsubishi2mqtt integration.
 * Topic pattern: mitsubishi2mqtt/{deviceIdentifier}/{command}/set
 *
 * This implementation follows the Strategy pattern, allowing the system
 * to use MQTT as one of potentially many control protocols.
 */
@Service("mqttProtocolPublisher")
public class MqttProtocolPublisher implements ProtocolPublisher {

    private static final Logger logger = LoggerFactory.getLogger(MqttProtocolPublisher.class);
    private static final String TOPIC_PATTERN = "%s/%s/%s/set";  // base-topic/deviceId/command/set

    private final String brokerUrl;
    private final String clientId;
    private final String baseTopic;
    private final String username;
    private final String password;

    private MqttClient mqttClient;

    public MqttProtocolPublisher(
        @Value("${mqtt.broker-url}") String brokerHost,
        @Value("${mqtt.broker-port}") int brokerPort,
        @Value("${mqtt.client-id}") String clientId,
        @Value("${mqtt.base-topic}") String baseTopic,
        @Value("${mqtt.username}") String username,
        @Value("${mqtt.password}") String password
    ) {
        this.brokerUrl = String.format("tcp://%s:%d", brokerHost, brokerPort);
        this.clientId = clientId + "-publisher";
        this.baseTopic = baseTopic;
        this.username = username;
        this.password = password;
    }

    @PostConstruct
    public void connect() throws MqttException {
        this.mqttClient = new MqttClient(brokerUrl, clientId);

        MqttConnectOptions options = new MqttConnectOptions();
        options.setAutomaticReconnect(true);
        options.setCleanSession(true);
        options.setConnectionTimeout(30);
        options.setKeepAliveInterval(60);

        if (username != null && !username.isBlank()) {
            options.setUserName(username);
            options.setPassword(password.toCharArray());
        }

        mqttClient.connect(options);
        logger.info("MQTT Protocol Publisher connected to broker: {}", brokerUrl);
    }

    @PreDestroy
    public void disconnect() throws MqttException {
        if (mqttClient != null && mqttClient.isConnected()) {
            mqttClient.disconnect();
            mqttClient.close();
            logger.info("MQTT Protocol Publisher disconnected");
        }
    }

    @Override
    public Mono<Void> setTemperature(String deviceIdentifier, int temperature) {
        return publishCommand(deviceIdentifier, "temp", String.valueOf(temperature));
    }

    @Override
    public Mono<Void> setMode(String deviceIdentifier, String mode) {
        return publishCommand(deviceIdentifier, "mode", mode);
    }

    @Override
    public Mono<Void> setFanSpeed(String deviceIdentifier, String fanSpeed) {
        return publishCommand(deviceIdentifier, "fan", fanSpeed);
    }

    @Override
    public Mono<Void> setPower(String deviceIdentifier, boolean on) {
        return publishCommand(deviceIdentifier, "power", on ? "ON" : "OFF");
    }

    @Override
    public Mono<Void> setVanePosition(String deviceIdentifier, String position) {
        return publishCommand(deviceIdentifier, "vane", position);
    }

    @Override
    public Mono<Void> setWideVanePosition(String deviceIdentifier, String position) {
        return publishCommand(deviceIdentifier, "wideVane", position);
    }

    @Override
    public String getProtocolName() {
        return "MQTT";
    }

    /**
     * Publish command to MQTT broker.
     *
     * @param deviceIdentifier Device identifier
     * @param command Command type (temp, mode, fan, power, vane, wideVane)
     * @param payload Command payload
     * @return Mono that completes when publish succeeds
     */
    private Mono<Void> publishCommand(String deviceIdentifier, String command, String payload) {
        return Mono.fromCallable(() -> {
            String topic = String.format(TOPIC_PATTERN, baseTopic, deviceIdentifier, command);
            MqttMessage message = new MqttMessage(payload.getBytes());
            message.setQos(1); // At least once delivery
            message.setRetained(false);

            mqttClient.publish(topic, message);
            logger.debug("Published MQTT command: topic={}, payload={}", topic, payload);

            return null;
        }).then();
    }
}
