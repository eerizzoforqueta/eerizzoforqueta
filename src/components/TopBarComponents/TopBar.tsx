import * as React from "react";
import {
  AppBar,
  Box,
  Container,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Toolbar,
  Avatar,
  Drawer,
  Button,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import Link from "next/link";
import { useRouter } from "next/router";
import Image from "next/image";

import { useSession, signOut } from "next-auth/react";

const pages = [
  { title: "Cadastro de alunos", link: "/StudentRegistration" },
  { title: "Painel do Administrador", link: "/AdminPage" },
  { title: "Frequencia Mensal", link: "/StudentPresenceTable" },
];

export default function ResponsiveAppBar() {
  const { data: session } = useSession(); // useSession para verificar se o usuário está logado
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const router = useRouter();
  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleAuthClick = () => {
    if (session) {
      signOut();
    } else {
      router.push("/LoginPage");
    }
  };

  const renderList = (
    items: typeof pages,
    direction: "column" | "row" = "row"
  ) => (
    <List
      sx={{
        display: "flex",
        flexDirection: direction,
        alignItems: "center",
        gap: "10px",
      }}
    >
      {items.map((item) => (
        <Link
          href={item.link}
          passHref
          key={item.title}
          style={{ textDecoration: "none" }}
        >
          {" "}
          {/* Estilo inline para remover o sublinhado */}
          <ListItem disablePadding component="div">
            <ListItemButton
              sx={{
                textDecoration: "none",
                color: "#FFFFFF", // Cor padrão para desktop
                margin: "0 16px",
                fontWeight: "700",
                "&:hover, &:focus, &:active, &:visited": {
                  textDecoration: "none", // Sobrescrever todos os estados para remover o sublinhado
                },
                // Aplicar cor preta para texto no modo responsivo
                "@media (max-width:600px)": {
                  color: "black",
                },
              }}
            >
              <ListItemText primary={item.title} />
            </ListItemButton>
          </ListItem>
        </Link>
      ))}
      <Button variant="contained" onClick={handleAuthClick}>
        {session ? "Deslogar" : "Login"}
      </Button>
    </List>
  );

  const links = renderList(pages);
  const drawerLinks = renderList(pages, "column");

  return (
    <AppBar position="static" color="secondary">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              alignItems: "center",
            }}
          >
            <Link href={"/"} passHref>
              <Avatar
                sx={{
                  width: 70, // tamanho do Avatar
                  height: 70, // tamanho do Avatar
                  // boxShadow: 'none' // Descomente se necessário
                  backgroundColor: "white",
                  marginTop: "5px",
                  marginBottom: "5px",
                }}
              >
                <Image
                  src="https://firebasestorage.googleapis.com/v0/b/mauriciodallonder-64688.appspot.com/o/logoNovoRizzo.jpeg?alt=media&token=72c25b2d-fe50-4fac-84d4-c072d2e6ed5f"
                  alt=""
                  layout="fill" // Isso fará a imagem preencher o Avatar
                  objectFit="contain" // Isso garante que a imagem inteira seja visível
                />
              </Avatar>
            </Link>

            <IconButton
              edge="start"
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: "none" } }}
            >
              <MenuIcon />
            </IconButton>
            <Box
              sx={{ display: { xs: "none", sm: "flex", listStyle: "none" } }}
            >
              {links}
            </Box>
          </Box>
        </Toolbar>
      </Container>
      <Drawer anchor="right" open={drawerOpen} onClose={handleDrawerToggle}>
        <IconButton
          edge="end"
          color="inherit"
          aria-label="close drawer"
          onClick={handleDrawerToggle}
          sx={{ mr: 2 }}
        >
          <CloseIcon />
        </IconButton>
        {drawerLinks}
      </Drawer>
    </AppBar>
  );
}
