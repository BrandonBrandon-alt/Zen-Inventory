package co.com.zenvory.inventario.transfer.application.service;

import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.transfer.application.port.in.DispatchTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.ReceiveTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.out.TransferRepositoryPort;
import co.com.zenvory.inventario.transfer.domain.model.Transfer;
import co.com.zenvory.inventario.transfer.domain.model.TransferDetail;
import co.com.zenvory.inventario.transfer.domain.model.TransferPriority;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("TransferService — despacho y recepción completos")
class TransferServiceTest {

    private TransferRepositoryPort repo;
    private InventoryUseCase inventory;
    private TransferService service;
    private Transfer transfer;

    @BeforeEach
    void setUp() {
        repo = mock(TransferRepositoryPort.class);
        inventory = mock(InventoryUseCase.class);
        ProductUseCase products = mock(ProductUseCase.class);
        UserRepositoryPort users = mock(UserRepositoryPort.class);
        service = new TransferService(repo, inventory, products, mock(AlertUseCase.class), users);

        User manager = User.builder().id(9L).nombre("Ana").email("ana@x.co").sucursalId(1L)
                .role(Role.builder().id(2L).nombre("MANAGER").build()).build();
        User destinationManager = User.builder().id(10L).nombre("Luis").email("luis@x.co").sucursalId(2L)
                .role(Role.builder().id(2L).nombre("MANAGER").build()).build();
        User outsider = User.builder().id(11L).nombre("Eva").email("eva@x.co").sucursalId(99L)
                .role(Role.builder().id(2L).nombre("MANAGER").build()).build();
        User admin = User.builder().id(12L).nombre("Root").email("root@x.co")
                .role(Role.builder().id(1L).nombre("ADMIN").build()).build();
        when(users.findByEmail("ana@x.co")).thenReturn(Optional.of(manager));
        when(users.findByEmail("luis@x.co")).thenReturn(Optional.of(destinationManager));
        when(users.findByEmail("eva@x.co")).thenReturn(Optional.of(outsider));
        when(users.findByEmail("root@x.co")).thenReturn(Optional.of(admin));
        when(products.getProductById(any())).thenReturn(Product.builder().name("P").build());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("ana@x.co", null, List.of()));

        transfer = Transfer.create(1L, 2L, null,
                List.of(new TransferDetail(11L, 5L, "A", 10, 0, 0, 0), new TransferDetail(12L, 6L, "B", 4, 0, 0, 0)),
                TransferPriority.NORMAL, 9L, "Ana");
        transfer.approveDestination(9L, "Ana");
        transfer.prepare(9L, "Ana");
        when(repo.findById(1L)).thenReturn(Optional.of(transfer));
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private void actAs(String email) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(email, null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private DispatchTransferCommand dispatch(DispatchTransferCommand.DispatchDetail... items) {
        return new DispatchTransferCommand("DHL", BigDecimal.ONE, "T1", null, List.of(items));
    }

    @Test
    @DisplayName("despachar exige la cantidad de TODAS las líneas (una omitida dejaría su reserva bloqueada para siempre)")
    void dispatchMustCoverEveryLine() {
        assertThatThrownBy(() -> service.dispatchTransfer(1L, dispatch(new DispatchTransferCommand.DispatchDetail(11L, 10))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(inventory, never()).withdrawStock(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("una línea repetida en el despacho se rechaza")
    void dispatchRejectsRepeatedLine() {
        assertThatThrownBy(() -> service.dispatchTransfer(1L, dispatch(
                new DispatchTransferCommand.DispatchDetail(11L, 1), new DispatchTransferCommand.DispatchDetail(11L, 1))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("despachar más de lo solicitado se rechaza")
    void dispatchRejectsExcess() {
        assertThatThrownBy(() -> service.dispatchTransfer(1L, dispatch(
                new DispatchTransferCommand.DispatchDetail(11L, 99), new DispatchTransferCommand.DispatchDetail(12L, 4))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("despacho completo: libera la reserva y retira lo enviado; una línea enviada en 0 no genera movimiento")
    void dispatchOk() {
        service.dispatchTransfer(1L, dispatch(
                new DispatchTransferCommand.DispatchDetail(11L, 10), new DispatchTransferCommand.DispatchDetail(12L, 0)));
        verify(inventory).releaseStock(1L, 5L, BigDecimal.valueOf(10));
        verify(inventory).releaseStock(1L, 6L, BigDecimal.valueOf(4));
        verify(inventory).withdrawStock(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    private void inTransit() {
        service.dispatchTransfer(1L, dispatch(
                new DispatchTransferCommand.DispatchDetail(11L, 10), new DispatchTransferCommand.DispatchDetail(12L, 4)));
    }

    @Test
    @DisplayName("no se puede recibir más de lo enviado (no se crea stock de la nada)")
    void receiveRejectsExcess() {
        inTransit();
        actAs("luis@x.co");
        assertThatThrownBy(() -> service.receiveTransfer(1L, new ReceiveTransferCommand("n", List.of(
                new ReceiveTransferCommand.ReceivedDetail(11L, 500), new ReceiveTransferCommand.ReceivedDetail(12L, 4)))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(inventory, never()).addStock(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("recibir exige todas las líneas")
    void receiveMustCoverEveryLine() {
        inTransit();
        actAs("luis@x.co");
        assertThatThrownBy(() -> service.receiveTransfer(1L, new ReceiveTransferCommand("n", List.of(
                new ReceiveTransferCommand.ReceivedDetail(11L, 10)))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("recepción con faltante: ingresa lo recibido y marca la novedad")
    void receiveWithShortage() {
        inTransit();
        actAs("luis@x.co");
        service.receiveTransfer(1L, new ReceiveTransferCommand("n", List.of(
                new ReceiveTransferCommand.ReceivedDetail(11L, 7), new ReceiveTransferCommand.ReceivedDetail(12L, 4))));
        verify(inventory).addStock(any(), any(), org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(7)), any(), any(), any(), any(), any(), any(), any(), any());
        assertThat(transfer.getStatus().name()).isEqualTo("WITH_ISSUE");
    }

    @Test
    @DisplayName("quien no pertenece a la sucursal de origen no puede despachar")
    void outsiderCannotDispatch() {
        actAs("eva@x.co");
        assertThatThrownBy(() -> service.dispatchTransfer(1L, dispatch(
                new DispatchTransferCommand.DispatchDetail(11L, 10), new DispatchTransferCommand.DispatchDetail(12L, 4))))
                .isInstanceOf(co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException.class);
        verify(inventory, never()).releaseStock(any(), any(), any());
    }

    @Test
    @DisplayName("la sucursal de destino no puede despachar (el stock sale del origen)")
    void destinationCannotDispatch() {
        actAs("luis@x.co");
        assertThatThrownBy(() -> service.dispatchTransfer(1L, dispatch(
                new DispatchTransferCommand.DispatchDetail(11L, 10), new DispatchTransferCommand.DispatchDetail(12L, 4))))
                .isInstanceOf(co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException.class);
    }

    @Test
    @DisplayName("el origen no puede recibir su propio envío")
    void originCannotReceive() {
        inTransit();
        assertThatThrownBy(() -> service.receiveTransfer(1L, new ReceiveTransferCommand("n", List.of(
                new ReceiveTransferCommand.ReceivedDetail(11L, 10), new ReceiveTransferCommand.ReceivedDetail(12L, 4)))))
                .isInstanceOf(co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException.class);
        verify(inventory, never()).addStock(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("un ADMIN actúa en cualquier paso, sea cual sea su sucursal")
    void adminCanActAnywhere() {
        actAs("root@x.co");
        service.dispatchTransfer(1L, dispatch(
                new DispatchTransferCommand.DispatchDetail(11L, 10), new DispatchTransferCommand.DispatchDetail(12L, 4)));
        service.receiveTransfer(1L, new ReceiveTransferCommand("n", List.of(
                new ReceiveTransferCommand.ReceivedDetail(11L, 10), new ReceiveTransferCommand.ReceivedDetail(12L, 4))));
        assertThat(transfer.getStatus().name()).isEqualTo("DELIVERED");
    }

    @Test
    @DisplayName("solo se solicitan traslados hacia la propia sucursal")
    void requestOnlyTowardsOwnBranch() {
        // Ana (sucursal 1) pide stock "hacia" la sucursal 2: no es su sucursal.
        assertThatThrownBy(() -> service.requestTransfer(new co.com.zenvory.inventario.transfer.application.port.in.RequestTransferCommand(
                3L, 2L, null, null, List.of(new co.com.zenvory.inventario.transfer.application.port.in.RequestTransferCommand.Detail(5L, 1)))))
                .isInstanceOf(co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException.class);
        verify(inventory, never()).reserveStock(any(), any(), any());
    }

    @Test
    @DisplayName("el destino sí puede solicitar el traslado: el stock se reserva en el origen")
    void destinationCanRequest() {
        actAs("luis@x.co");
        service.requestTransfer(new co.com.zenvory.inventario.transfer.application.port.in.RequestTransferCommand(
                1L, 2L, null, null, List.of(new co.com.zenvory.inventario.transfer.application.port.in.RequestTransferCommand.Detail(5L, 3))));
        verify(inventory).reserveStock(1L, 5L, BigDecimal.valueOf(3));
    }
}
